'use server'

// ============================================================
// MODUL: clinical_document — aksi catatan klinis (Fase 2)
// Kepatuhan inti:
// - Tidak ada jalur hapus. Setiap "simpan" membuat VERSI BARU dari
//   dokumen; versi lama tetap tersimpan (riwayat lengkap).
// - PPA pendamping hanya boleh mengisi bagian asesmen (anamnesis,
//   tanda vital, pemeriksaan) — tidak bagian rencana tatalaksana.
// - Kunjungan hanya bisa dikunci bila field wajib lengkap (PMK 24/2022).
// - Membuka kunci = hak Penanggung Jawab, wajib beralasan, teraudit.
// ============================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import { cekKelengkapan, templateUntukProfesi, type IsiDokumen } from './templates'
import { masukkanAntreanKunjungan } from '@/lib/modules/integration_satusehat/outbox'

export interface AksiState {
  error?: string
  success?: string
  kurang?: string[]
}

const isiSchema = z.record(z.string(), z.record(z.string(), z.string().max(5000)))

function parseIsi(formData: FormData): IsiDokumen | null {
  const mentah = String(formData.get('content') ?? '')
  if (!mentah) return null
  try {
    const obj = JSON.parse(mentah) as unknown
    const hasil = isiSchema.safeParse(obj)
    return hasil.success ? (hasil.data as IsiDokumen) : null
  } catch {
    return null
  }
}

async function muatKunjungan(kunjunganId: string, organizationId: string) {
  return db.encounter.findFirst({
    where: { id: kunjunganId, organizationId },
    include: {
      patient: true,
      documents: { where: { isCurrent: true }, orderBy: { version: 'desc' } },
      diagnoses: true,
      procedures: true,
      prescriptions: { include: { items: true } },
    },
  })
}

export async function simpanCatatan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.klinis')
  const kunjunganId = String(formData.get('encounterId') ?? '')
  const kunjungan = await muatKunjungan(kunjunganId, ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status)) {
    return {
      error: 'Kunjungan terkunci. Koreksi hanya lewat pembukaan kunci oleh Penanggung Jawab (tercatat diaudit), lalu simpan sebagai versi baru.',
    }
  }
  if (kunjungan.status === 'BATAL') return { error: 'Kunjungan sudah dibatalkan.' }

  const isi = parseIsi(formData)
  if (!isi) return { error: 'Format isi catatan tidak valid.' }

  // Profesi penulis menentukan templat; pendamping dibatasi bagian asesmen.
  const akun = await db.user.findUnique({ where: { id: ctx.auth.userId }, select: { profession: true } })
  const profesiPenulis = akun?.profession ?? 'Dokter'
  const templateAktif = templateUntukProfesi(profesiPenulis)

  const isPendamping =
    ctx.roles.includes('PPA_PENDAMPING') &&
    !ctx.roles.includes('PPA') &&
    !ctx.roles.includes('PENANGGUNG_JAWAB')

  if (isPendamping) {
    const dibolehkan = new Set(templateAktif.sections.filter((s) => s.pendampingBoleh).map((s) => s.key))
    for (const kunciBagian of Object.keys(isi)) {
      if (!dibolehkan.has(kunciBagian)) {
        return {
          error: 'PPA pendamping hanya mengisi bagian anamnesis, tanda vital, dan pemeriksaan. Bagian lain bukan kewenangan.',
        }
      }
    }
  }

  const lama = kunjungan.documents.find((d) => d.type === 'CATATAN_PEMERIKSAAN' && d.isCurrent)
  const versiBerikut = (lama?.version ?? 0) + 1

  await db.$transaction([
    ...(lama ? [db.clinicalDocument.update({ where: { id: lama.id }, data: { isCurrent: false } })] : []),
    db.clinicalDocument.create({
      data: {
        organizationId: ctx.organizationId,
        encounterId: kunjungan.id,
        type: 'CATATAN_PEMERIKSAAN',
        profession: profesiPenulis,
        version: versiBerikut,
        isCurrent: true,
        content: JSON.stringify(isi),
        createdByLabel: ctx.auth.fullName,
      },
    }),
  ])

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'SIMPAN_CATATAN',
    objectType: 'ClinicalDocument',
    objectId: kunjungan.id,
    summary: `${kunjungan.encounterNumber}: catatan pemeriksaan disimpan sebagai versi ${versiBerikut} oleh ${ctx.auth.fullName}`,
    detail: { versi: versiBerikut, profesi: profesiPenulis },
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return { success: `Catatan disimpan sebagai versi ${versiBerikut}. Versi sebelumnya tetap tersimpan.` }
}

/// Simpan odontogram (dokter gigi, Fase 7). Satu dokumen per kunjungan, berversi.
export async function simpanOdontogram(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.klinis')
  const kunjunganId = String(formData.get('encounterId') ?? '')
  const peta = String(formData.get('teeth') ?? '{}')
  const kunjungan = await muatKunjungan(kunjunganId, ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status)) {
    return { error: 'Kunjungan terkunci. Gunakan pembukaan kunci untuk koreksi.' }
  }
  try {
    const obj = JSON.parse(peta) as Record<string, string>
    const valid = Object.values(obj).every((v) => typeof v === 'string')
    if (!valid) return { error: 'Data odontogram tidak valid.' }
  } catch {
    return { error: 'Data odontogram tidak valid.' }
  }

  const lama = kunjungan.documents.find((d) => d.type === 'ODONTOGRAM' && d.isCurrent)
  const versiBerikut = (lama?.version ?? 0) + 1

  await db.$transaction([
    ...(lama ? [db.clinicalDocument.update({ where: { id: lama.id }, data: { isCurrent: false } })] : []),
    db.clinicalDocument.create({
      data: {
        organizationId: ctx.organizationId,
        encounterId: kunjungan.id,
        type: 'ODONTOGRAM',
        profession: 'Dokter Gigi',
        version: versiBerikut,
        isCurrent: true,
        content: peta,
        createdByLabel: ctx.auth.fullName,
      },
    }),
  ])

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'SIMPAN_CATATAN',
    objectType: 'ClinicalDocument',
    objectId: kunjungan.id,
    summary: `${kunjungan.encounterNumber}: odontogram disimpan (versi ${versiBerikut})`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: `Odontogram disimpan (versi ${versiBerikut}).` }
}

/// Kunci kunjungan: cek kelengkapan PMK 24/2022 → masukkan antrean FHIR.
export async function kunciKunjungan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.kunci')
  const kunjunganId = String(formData.get('encounterId') ?? '')
  const kunjungan = await muatKunjungan(kunjunganId, ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (kunjungan.status !== 'SELESAI') {
    return { error: 'Hanya kunjungan berstatus Selesai yang bisa dikunci.' }
  }

  const akun = await db.user.findUnique({ where: { id: ctx.auth.userId }, select: { profession: true } })
  const template = templateUntukProfesi(akun?.profession ?? 'Dokter')
  const doc = kunjungan.documents.find((d) => d.type === 'CATATAN_PEMERIKSAAN' && d.isCurrent)
  const isi = doc ? (JSON.parse(doc.content) as IsiDokumen) : null
  const odontogram = kunjungan.documents.find((d) => d.type === 'ODONTOGRAM' && d.isCurrent)

  const adaTerapi = kunjungan.prescriptions.some((r) => r.status !== 'DIBATALKAN')

  const kurang = cekKelengkapan(template, isi, {
    adaDiagnosa: kunjungan.diagnoses.length > 0,
    adaOdontogram: Boolean(odontogram),
    adaTerapi,
  })

  if (kurang.length > 0) {
    return { error: 'Kelengkapan belum memenuhi daftar minimal rekam medis rawat jalan.', kurang }
  }

  await db.encounter.update({
    where: { id: kunjungan.id },
    data: { status: 'DIKUNCI', lockedAt: new Date(), lockedByLabel: ctx.auth.fullName },
  })

  // Masukkan ke antrean outbox SATUSEHAT (Fase 5) bila integrasi aktif.
  await masukkanAntreanKunjungan(kunjungan.id, ctx.organizationId)

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'KUNCI_KUNJUNGAN',
    objectType: 'Encounter',
    objectId: kunjungan.id,
    summary: `${kunjungan.encounterNumber}: kunjungan ${kunjungan.patient.name} dikunci oleh ${ctx.auth.fullName}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return { success: 'Kunjungan dikunci. Catatan tidak dapat diubah lagi tanpa pembukaan kunci yang diaudit.' }
}

/// Buka kunci (koreksi): hanya PJ, wajib alasan, kunjungan kembali DIPERIKSA.
export async function bukaKunjungan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.buka')
  const alasan = String(formData.get('reason') ?? '').trim()
  const kunjunganId = String(formData.get('encounterId') ?? '')
  const kunjungan = await muatKunjungan(kunjunganId, ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (!['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status)) {
    return { error: 'Kunjungan ini tidak sedang terkunci.' }
  }
  if (alasan.length < 10) {
    return { error: 'Pembukaan kunci wajib menyertakan alasan koreksi (minimal 10 karakter).' }
  }

  await db.encounter.update({
    where: { id: kunjungan.id },
    data: { status: 'DIPERIKSA', lockedAt: null, lockedByLabel: null },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'BUKA_KUNJUNGAN',
    objectType: 'Encounter',
    objectId: kunjungan.id,
    reason: alasan,
    summary: `${kunjungan.encounterNumber}: kunci dibuka untuk koreksi oleh ${ctx.auth.fullName}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Kunci dibuka. Perbaiki catatan lalu kunci kembali; semua versi tetap tersimpan.' }
}
