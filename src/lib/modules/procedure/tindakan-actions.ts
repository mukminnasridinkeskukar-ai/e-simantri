'use server'

// ============================================================
// MODUL: procedure & diagnosis — diagnosa ICD-10 + tindakan (Fase 3)
// Diagnosa WAJIB punya kode ICD-10 (mapper FHIR menolak kosong).
// Tindakan: nama wajib, kode ICD-9-CM opsional; bila tindakan berisiko,
// persetujuan wajib dicatat (checkbox → membuat ConsentRecord).
// Kunjungan terkunci tidak boleh diubah.
// ============================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { getRequestMeta } from '@/lib/modules/identity_access/session'

export interface AksiState {
  error?: string
  success?: string
}

const diagSchema = z.object({
  icd10Code: z.string().trim().regex(/^[A-Z]\d{2}(\.\d{1,4})?$/, 'Kode ICD-10 tidak valid (contoh: J06.9).'),
  display: z.string().trim().min(2).max(200),
  kind: z.enum(['UTAMA', 'SEKUNDER']),
  note: z.string().max(300).optional(),
})

async function muatKunjungan(kunjunganId: string, organizationId: string) {
  return db.encounter.findFirst({
    where: { id: kunjunganId, organizationId },
    include: { patient: true },
  })
}

async function pastikanTerbuka(status: string): Promise<string | null> {
  if (['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(status)) {
    return 'Kunjungan terkunci. Minta Penanggung Jawab membuka kunci untuk koreksi (tercatat diaudit).'
  }
  if (status === 'BATAL') return 'Kunjungan sudah dibatalkan.'
  return null
}

export async function tambahDiagnosa(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.klinis')
  const kunjungan = await muatKunjungan(String(formData.get('encounterId') ?? ''), ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  const terkunci = await pastikanTerbuka(kunjungan.status)
  if (terkunci) return { error: terkunci }

  const parsed = diagSchema.safeParse({
    icd10Code: String(formData.get('icd10Code') ?? '').toUpperCase(),
    display: formData.get('display'),
    kind: formData.get('kind'),
    note: formData.get('note') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data diagnosa belum lengkap.' }

  // Kode harus ada di daftar terminologi (bawaan platform atau kustom praktik).
  const kode = await db.terminologyCode.findFirst({
    where: {
      system: 'ICD10',
      code: parsed.data.icd10Code,
      isActive: true,
      OR: [{ organizationId: null }, { organizationId: ctx.organizationId }],
    },
  })
  if (!kode) {
    return {
      error: `Kode ${parsed.data.icd10Code} belum ada pada daftar ICD-10 praktik. Tambahkan pada modul Terminologi bila memang dibutuhkan.`,
    }
  }

  // Satu diagnosa utama per kunjungan.
  if (parsed.data.kind === 'UTAMA') {
    const adaUtama = await db.encounterDiagnosis.findFirst({
      where: { encounterId: kunjungan.id, kind: 'UTAMA' },
    })
    if (adaUtama) {
      return { error: 'Sudah ada diagnosa utama. Ubah diagnosa lama menjadi sekunder terlebih dahulu (bila perlu buat ulang).' }
    }
  }

  await db.encounterDiagnosis.create({
    data: {
      organizationId: ctx.organizationId,
      encounterId: kunjungan.id,
      icd10Code: parsed.data.icd10Code,
      display: kode.display,
      kind: parsed.data.kind,
      note: parsed.data.note || null,
      createdByLabel: ctx.auth.fullName,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'TAMBAH_TINDAKAN',
    objectType: 'EncounterDiagnosis',
    objectId: kunjungan.id,
    summary: `${kunjungan.encounterNumber}: diagnosa ${parsed.data.icd10Code} (${parsed.data.kind}) untuk ${kunjungan.patient.name}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: `Diagnosa ${parsed.data.icd10Code} — ${kode.display} dicatat.` }
}

const tindakanSchema = z.object({
  name: z.string().trim().min(3, 'Nama tindakan minimal 3 karakter.').max(200),
  icd9cmCode: z.string().trim().max(12).optional(),
  note: z.string().max(500).optional(),
  perluPersetujuan: z.string().optional(),
  namaPemberiPersetujuan: z.string().max(120).optional(),
})

export async function tambahTindakan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('tindakan.kelola')
  const kunjungan = await muatKunjungan(String(formData.get('encounterId') ?? ''), ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  const terkunci = await pastikanTerbuka(kunjungan.status)
  if (terkunci) return { error: terkunci }

  const parsed = tindakanSchema.safeParse({
    name: formData.get('name'),
    icd9cmCode: String(formData.get('icd9cmCode') ?? '').toUpperCase(),
    note: formData.get('note') || undefined,
    perluPersetujuan: formData.get('perluPersetujuan') || undefined,
    namaPemberiPersetujuan: formData.get('namaPemberiPersetujuan') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data tindakan belum lengkap.' }
  const data = {
    ...parsed.data,
    icd9cmCode: parsed.data.icd9cmCode === 'TANPA' ? undefined : parsed.data.icd9cmCode,
  }

  const perluPersetujuan = data.perluPersetujuan === 'ya'
  if (perluPersetujuan && (!data.namaPemberiPersetujuan || data.namaPemberiPersetujuan.length < 3)) {
    return { error: 'Nama pemberi persetujuan wajib diisi untuk tindakan yang memerlukan persetujuan.' }
  }

  let consentId: string | null = null
  if (perluPersetujuan) {
    const consent = await db.consentRecord.create({
      data: {
        organizationId: ctx.organizationId,
        patientId: kunjungan.patientId,
        encounterId: kunjungan.id,
        type: 'TINDAKAN',
        agreedText:
          `Saya setuju dilakukan tindakan berikut: ${data.name}. Saya telah menerima penjelasan mengenai manfaat, risiko, dan alternatif tindakan.`,
        agreedByName: data.namaPemberiPersetujuan ?? kunjungan.patient.name,
        agreedByRole: 'PASIEN',
        method: 'ELEKTRONIK',
      },
    })
    consentId = consent.id
  }

  await db.encounterProcedure.create({
    data: {
      organizationId: ctx.organizationId,
      encounterId: kunjungan.id,
      icd9cmCode: data.icd9cmCode || null,
      name: data.name,
      note: data.note || null,
      performerLabel: ctx.auth.fullName,
      consentId,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'TAMBAH_TINDAKAN',
    objectType: 'EncounterProcedure',
    objectId: kunjungan.id,
    summary: `${kunjungan.encounterNumber}: tindakan "${data.name}" dicatat oleh ${ctx.auth.fullName}`,
    detail: { kodeICD9CM: data.icd9cmCode || null, adaPersetujuan: perluPersetujuan },
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Tindakan dicatat.' }
}
