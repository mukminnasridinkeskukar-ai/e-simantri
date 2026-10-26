'use server'

// ============================================================
// MODUL: billing_claim — tagihan ringan (Fase 8)
// Tagihan dibuat dari kunjungan terkunci. Pembatalan wajib alasan.
// TIDAK ADA integrasi BPJS — hanya pencatatan & ekspor CSV.
// ============================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { nomorTagihan } from '@/lib/modules/konstanta'
import { getRequestMeta } from '@/lib/modules/identity_access/session'

export interface AksiState {
  error?: string
  success?: string
}

const itemBarisSchema = z.array(
  z.object({
    deskripsi: z.string().trim().min(2, 'Deskripsi item wajib diisi.').max(200),
    qty: z.number().int().min(1).max(999),
    harga: z.number().int().min(0).max(1_000_000_000),
  })
).min(1, 'Minimal satu item tagihan.')

export async function buatTagihan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('klaim.kelola')
  const encounterId = String(formData.get('encounterId') ?? '')

  const kunjungan = await db.encounter.findFirst({
    where: { id: encounterId, organizationId: ctx.organizationId },
    include: { patient: true },
  })
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (!['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status)) {
    return { error: 'Tagihan hanya dibuat dari kunjungan yang sudah dikunci.' }
  }

  let items: unknown
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]')).map((it: { deskripsi?: string; qty?: string; harga?: string }) => ({
      deskripsi: String(it.deskripsi ?? ''),
      qty: parseInt(String(it.qty ?? '1'), 10) || 0,
      harga: parseInt(String(it.harga ?? '0'), 10) || 0,
    }))
  } catch {
    return { error: 'Format tagihan tidak valid.' }
  }
  const parsed = itemBarisSchema.safeParse(items)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Item tagihan belum lengkap.' }

  const ada = await db.invoice.findFirst({ where: { encounterId: kunjungan.id, status: { not: 'DIBATALKAN' } } })
  if (ada) return { error: `Kunjungan ini sudah punya tagihan aktif (${ada.invoiceNumber}).` }

  const total = parsed.data.reduce((acc, it) => acc + it.qty * it.harga, 0)
  const invoiceNumber = await nomorTagihan(ctx.organizationId)

  const invoice = await db.invoice.create({
    data: {
      organizationId: ctx.organizationId,
      encounterId: kunjungan.id,
      invoiceNumber,
      items: JSON.stringify(parsed.data),
      total,
      payerType: kunjungan.paymentMethod,
      payerName: kunjungan.patient.name,
      createdByLabel: ctx.auth.fullName,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'SIMPAN_TAGIHAN',
    objectType: 'Invoice',
    objectId: invoice.id,
    summary: `Tagihan ${invoiceNumber} diterbitkan untuk ${kunjungan.patient.name} (${kunjungan.encounterNumber})`,
    detail: { total },
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: `Tagihan ${invoiceNumber} terbit.` }
}

export async function tandaiDibayar(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('klaim.kelola')
  const invoiceId = String(formData.get('invoiceId') ?? '')
  const metode = String(formData.get('paymentMethod') ?? 'TUNAI')
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: ctx.organizationId },
    include: { encounter: { include: { patient: true } } },
  })
  if (!invoice) return { error: 'Tagihan tidak ditemukan.' }
  if (invoice.status !== 'TERBIT') return { error: 'Hanya tagihan yang diterbitkan bisa ditandai dibayar.' }

  await db.invoice.update({
    where: { id: invoice.id },
    data: { status: 'DIBAYAR', paymentMethod: metode, paidAt: new Date() },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_TAGIHAN',
    objectType: 'Invoice',
    objectId: invoice.id,
    summary: `Tagihan ${invoice.invoiceNumber} (${invoice.encounter.patient.name}) dibayar via ${metode}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Tagihan ditandai dibayar.' }
}

export async function batalkanTagihan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('klaim.kelola')
  const invoiceId = String(formData.get('invoiceId') ?? '')
  const alasan = String(formData.get('reason') ?? '').trim()
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: ctx.organizationId },
  })
  if (!invoice) return { error: 'Tagihan tidak ditemukan.' }
  if (invoice.status === 'DIBAYAR') return { error: 'Tagihan yang sudah dibayar tidak dibatalkan; gunakan catatan koreksi.' }
  if (alasan.length < 5) return { error: 'Alasan pembatalan wajib diisi (minimal 5 karakter).' }

  await db.invoice.update({
    where: { id: invoice.id },
    data: { status: 'DIBATALKAN', canceledReason: alasan },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_TAGIHAN',
    objectType: 'Invoice',
    objectId: invoice.id,
    reason: alasan,
    summary: `Tagihan ${invoice.invoiceNumber} dibatalkan`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Tagihan dibatalkan. Catatan tetap tersimpan.' }
}
