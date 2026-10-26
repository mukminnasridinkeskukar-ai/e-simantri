'use server'

// ============================================================
// MODUL: referral — surat rujukan keluar (Fase 8)
// ============================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { nomorRujukan } from '@/lib/modules/konstanta'
import { getRequestMeta } from '@/lib/modules/identity_access/session'

export interface AksiState {
  error?: string
  success?: string
}

const schema = z.object({
  encounterId: z.string().min(1),
  destination: z.string().trim().min(3, 'Fasilitas tujuan wajib diisi.').max(200),
  reason: z.string().trim().min(5, 'Alasan rujukan wajib diisi.').max(500),
  notes: z.string().trim().max(500).optional(),
})

export async function buatRujukan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('rujukan.kelola')
  const parsed = schema.safeParse({
    encounterId: formData.get('encounterId'),
    destination: formData.get('destination'),
    reason: formData.get('reason'),
    notes: formData.get('notes') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data belum lengkap.' }

  const kunjungan = await db.encounter.findFirst({
    where: { id: parsed.data.encounterId, organizationId: ctx.organizationId },
    include: { patient: true, diagnoses: true },
  })
  if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
  if (!['SELESAI', 'DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status)) {
    return { error: 'Rujukan dibuat dari kunjungan yang sudah selesai atau terkunci.' }
  }

  const letterNumber = await nomorRujukan(ctx.organizationId)
  const rujukan = await db.referral.create({
    data: {
      organizationId: ctx.organizationId,
      encounterId: kunjungan.id,
      letterNumber,
      destination: parsed.data.destination,
      reason: parsed.data.reason,
      notes: parsed.data.notes || null,
      createdByLabel: ctx.auth.fullName,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'BUAT_RUJUKAN',
    objectType: 'Referral',
    objectId: rujukan.id,
    summary: `Rujukan ${letterNumber} dibuat untuk ${kunjungan.patient.name} → ${parsed.data.destination}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: `Surat rujukan ${letterNumber} dibuat.` }
}
