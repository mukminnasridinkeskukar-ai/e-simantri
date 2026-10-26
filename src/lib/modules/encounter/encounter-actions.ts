'use server'

// ============================================================
// MODUL: encounter — aksi kunjungan (Fase 1)
// Alur status: TERDAFTAR → DIPERIKSA → SELESAI → DIKUNCI →
// TERKIRIM/GAGAL_KIRIM (melalui antrean SATUSEHAT).
// BATAL hanya sebelum diperiksa, wajib beralasan, tetap teraudit.
// Mengunci mengecek kelengkapan field wajib rawat jalan (PMK 24/2022)
// dan memasukkan kejadian FHIR ke antrean outbox.
// ============================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { nomorKunjungan } from '@/lib/modules/konstanta'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import { masukkanAntreanKunjungan } from '@/lib/modules/integration_satusehat/outbox'

export interface AksiState {
  error?: string
  success?: string
}

const buatSchema = z.object({
  patientId: z.string().min(1, 'Pasien wajib dipilih.'),
  type: z.enum(['DATANG_SENDIRI', 'PERJANJIAN', 'TELEMEDISIN', 'KUNJUNGAN_RUMAH']),
  chiefComplaint: z.string().trim().min(3, 'Keluhan utama minimal 3 karakter.').max(200),
  paymentMethod: z.enum(['UANG_SENDIRI', 'ASURANSI', 'LAINNYA']),
  locationId: z.string().optional(),
  scheduledAt: z.string().optional(),
  telemedicineNote: z.string().max(300).optional(),
  persetujuanTelemedisin: z.string().optional(),
})

export async function buatKunjungan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.daftar')
  const parsed = buatSchema.safeParse({
    patientId: formData.get('patientId'),
    type: formData.get('type'),
    chiefComplaint: formData.get('chiefComplaint'),
    paymentMethod: formData.get('paymentMethod'),
    locationId: formData.get('locationId') || undefined,
    scheduledAt: formData.get('scheduledAt') || undefined,
    telemedicineNote: formData.get('telemedicineNote') || undefined,
    persetujuanTelemedisin: formData.get('persetujuanTelemedisin') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data belum lengkap.' }
  const data = parsed.data

  const pasien = await db.patient.findFirst({
    where: { id: data.patientId, organizationId: ctx.organizationId, status: 'AKTIF' },
  })
  if (!pasien) return { error: 'Pasien aktif tidak ditemukan pada praktik ini.' }

  let jadwal: Date | null = null
  if (data.type === 'PERJANJIAN') {
    if (!data.scheduledAt) return { error: 'Kunjungan perjanjian wajib memiliki jadwal.' }
    jadwal = new Date(data.scheduledAt)
    if (Number.isNaN(jadwal.getTime())) return { error: 'Format jadwal tidak valid.' }
  }
  if (data.type === 'TELEMEDISIN' && data.persetujuanTelemedisin !== 'setuju') {
    return { error: 'Kunjungan telemedisin memerlukan persetujuan pasien yang dicatat.' }
  }

  const encounterNumber = await nomorKunjungan(ctx.organizationId)
  const kunjungan = await db.encounter.create({
    data: {
      organizationId: ctx.organizationId,
      patientId: pasien.id,
      encounterNumber,
      type: data.type,
      chiefComplaint: data.chiefComplaint,
      paymentMethod: data.paymentMethod,
      locationId: data.locationId || null,
      scheduledAt: jadwal,
      telemedicineNote:
        data.type === 'TELEMEDISIN'
          ? `${data.telemedicineNote ?? ''} (persetujuan telemedisin dicatat saat pendaftaran)`.trim()
          : null,
    },
  })

  // Persetujuan telemedisin tercatat sebagai dokumen consent (Fase 6).
  if (data.type === 'TELEMEDISIN') {
    await db.consentRecord.create({
      data: {
        organizationId: ctx.organizationId,
        patientId: pasien.id,
        encounterId: kunjungan.id,
        type: 'TELEMEDISIN',
        agreedText:
          'Saya setuju menerima layanan konsultasi jarak jauh (telemedisin) pada praktik ini. Saya memahami keterbatasan pemeriksaan jarak jauh dan akan datang langsung bila diminta oleh tenaga kesehatan.',
        agreedByName: pasien.name,
        agreedByRole: 'PASIEN',
        method: 'ELEKTRONIK',
      },
    })
  }

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'BUAT_KUNJUNGAN',
    objectType: 'Encounter',
    objectId: kunjungan.id,
    summary: `Kunjungan ${encounterNumber} dibuat untuk ${pasien.name} — ${data.type}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return { success: `Kunjungan ${encounterNumber} terdaftar.` }
}

async function muatKunjungan(kunjunganId: string, organizationId: string) {
  return db.encounter.findFirst({
    where: { id: kunjunganId, organizationId },
    include: { patient: true },
  })
}

export async function mulaiPemeriksaan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.klinis')
  const kunjungan = await muatKunjungan(String(formData.get('encounterId') ?? ''), ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (kunjungan.status !== 'TERDAFTAR') {
    return { error: 'Hanya kunjungan berstatus Terdaftar yang bisa mulai diperiksa.' }
  }

  await db.encounter.update({
    where: { id: kunjungan.id },
    data: { status: 'DIPERIKSA', startedAt: new Date() },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_KUNJUNGAN',
    objectType: 'Encounter',
    objectId: kunjungan.id,
    summary: `${kunjungan.encounterNumber}: mulai memeriksa ${kunjungan.patient.name}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Pemeriksaan dimulai.' }
}

export async function selesaikanPemeriksaan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.klinis')
  const kunjungan = await muatKunjungan(String(formData.get('encounterId') ?? ''), ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (kunjungan.status !== 'DIPERIKSA') {
    return { error: 'Hanya kunjungan berstatus Diperiksa yang bisa diselesaikan.' }
  }

  await db.encounter.update({
    where: { id: kunjungan.id },
    data: { status: 'SELESAI', finishedAt: new Date() },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_KUNJUNGAN',
    objectType: 'Encounter',
    objectId: kunjungan.id,
    summary: `${kunjungan.encounterNumber}: pemeriksaan ${kunjungan.patient.name} selesai`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Pemeriksaan selesai. Kunjungan siap dikunci setelah catatan lengkap.' }
}

/// Batalkan kunjungan yang belum diperiksa. Tidak menghapus apa pun:
/// status menjadi BATAL dan seluruh jejak tetap tersimpan.
export async function batalkanPendaftaran(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('kunjungan.daftar')
  const alasan = String(formData.get('reason') ?? '').trim()
  const kunjungan = await muatKunjungan(String(formData.get('encounterId') ?? ''), ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (!['TERDAFTAR'].includes(kunjungan.status)) {
    return { error: 'Pembatalan hanya bisa dilakukan sebelum pemeriksaan dimulai.' }
  }
  if (alasan.length < 5) return { error: 'Alasan pembatalan wajib diisi (minimal 5 karakter).' }

  await db.encounter.update({
    where: { id: kunjungan.id },
    data: { status: 'BATAL', canceledAt: new Date(), canceledReason: alasan },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_KUNJUNGAN',
    objectType: 'Encounter',
    objectId: kunjungan.id,
    reason: alasan,
    summary: `${kunjungan.encounterNumber}: pendaftaran ${kunjungan.patient.name} dibatalkan`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Pendaftaran dibatalkan. Catatan kunjungan tetap tersimpan.' }
}
