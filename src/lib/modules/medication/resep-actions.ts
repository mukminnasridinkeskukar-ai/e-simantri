'use server'

// ============================================================
// MODUL: medication — resep (Fase 3)
// Kode obat memakai KFA. Pada lingkungan demo, daftar obat dan kode
// KFA adalah CONTOH (bukan katalog resmi); penggantian daftar resmi
// dilakukan lewat modul Terminologi tanpa mengubah alur aplikasi.
// ============================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { nomorResep } from '@/lib/modules/konstanta'
import { getRequestMeta } from '@/lib/modules/identity_access/session'

export interface AksiState {
  error?: string
  success?: string
}

const itemSchema = z.array(
  z.object({
    kfaCode: z.string().trim().max(40).optional(),
    drugName: z.string().trim().min(2, 'Nama obat wajib diisi.').max(160),
    strength: z.string().trim().max(60).optional(),
    form: z.string().trim().max(60).optional(),
    quantity: z.string().trim().min(1, 'Jumlah wajib diisi.').max(40),
    usage: z.string().trim().min(3, 'Aturan pakai wajib diisi.').max(200),
    note: z.string().trim().max(200).optional(),
  })
).min(1, 'Minimal satu obat pada resep.')

async function muatKunjungan(kunjunganId: string, organizationId: string) {
  return db.encounter.findFirst({
    where: { id: kunjunganId, organizationId },
    include: { patient: true },
  })
}

export async function simpanResep(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('resep.kelola')
  const kunjungan = await muatKunjungan(String(formData.get('encounterId') ?? ''), ctx.organizationId)
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status)) {
    return { error: 'Kunjungan terkunci. Minta Penanggung Jawab membuka kunci untuk koreksi.' }
  }
  if (kunjungan.status === 'BATAL') return { error: 'Kunjungan sudah dibatalkan.' }

  let items: unknown
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'))
  } catch {
    return { error: 'Format resep tidak valid.' }
  }
  const parsed = itemSchema.safeParse(items)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Resep belum lengkap.' }

  const prescriptionNumber = await nomorResep(ctx.organizationId)
  const resep = await db.prescription.create({
    data: {
      organizationId: ctx.organizationId,
      encounterId: kunjungan.id,
      prescriptionNumber,
      createdByLabel: ctx.auth.fullName,
      items: {
        create: parsed.data.map((it) => ({
          kfaCode: it.kfaCode || null,
          drugName: it.drugName,
          strength: it.strength || null,
          form: it.form || null,
          quantity: it.quantity,
          usage: it.usage,
          note: it.note || null,
        })),
      },
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'SIMPAN_RESEP',
    objectType: 'Prescription',
    objectId: resep.id,
    summary: `${kunjungan.encounterNumber}: resep ${prescriptionNumber} dibuat (${parsed.data.length} obat) oleh ${ctx.auth.fullName}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: `Resep ${prescriptionNumber} tersimpan.` }
}

export async function serahkanResep(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('resep.serahkan')
  const prescriptionId = String(formData.get('prescriptionId') ?? '')
  const resep = await db.prescription.findFirst({
    where: { id: prescriptionId, organizationId: ctx.organizationId },
    include: { encounter: { include: { patient: true } } },
  })
  if (!resep) return { error: 'Resep tidak ditemukan.' }
  if (resep.status !== 'DIBUAT') return { error: 'Hanya resep berstatus menunggu yang bisa diserahkan.' }

  await db.prescription.update({
    where: { id: resep.id },
    data: { status: 'DISELESAIKAN', dispensedByLabel: ctx.auth.fullName, dispensedAt: new Date() },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_RESEP',
    objectType: 'Prescription',
    objectId: resep.id,
    summary: `Resep ${resep.prescriptionNumber} (${resep.encounter.patient.name}) diserahkan oleh ${ctx.auth.fullName}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Obat ditandai sudah diserahkan.' }
}

export async function batalkanResep(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('resep.kelola')
  const prescriptionId = String(formData.get('prescriptionId') ?? '')
  const alasan = String(formData.get('reason') ?? '').trim()
  const resep = await db.prescription.findFirst({
    where: { id: prescriptionId, organizationId: ctx.organizationId },
    include: { encounter: { include: { patient: true } } },
  })
  if (!resep) return { error: 'Resep tidak ditemukan.' }
  if (resep.status !== 'DIBUAT') return { error: 'Hanya resep yang belum diserahkan bisa dibatalkan.' }
  if (alasan.length < 5) return { error: 'Alasan pembatalan wajib diisi (minimal 5 karakter).' }

  await db.prescription.update({
    where: { id: resep.id },
    data: { status: 'DIBATALKAN', statusNote: alasan },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_RESEP',
    objectType: 'Prescription',
    objectId: resep.id,
    reason: alasan,
    summary: `Resep ${resep.prescriptionNumber} (${resep.encounter.patient.name}) dibatalkan`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Resep dibatalkan. Catatan tetap tersimpan.' }
}
