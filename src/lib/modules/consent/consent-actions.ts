'use server'

// ============================================================
// MODUL: consent — catat persetujuan (Fase 6)
// Menyimpan snapshot teks persetujuan. Tidak dapat dihapus.
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

const schema = z.object({
  patientId: z.string().min(1, 'Pasien wajib dipilih.'),
  encounterId: z.string().optional(),
  type: z.enum(['PERSETUJUAN_UMUM', 'TINDAKAN', 'TELEMEDISIN', 'PENGAJUAN_DATA']),
  agreedText: z.string().trim().min(10, 'Teks persetujuan minimal 10 karakter.').max(2000),
  agreedByName: z.string().trim().min(3, 'Nama pemberi persetujuan wajib diisi.').max(120),
  agreedByRole: z.enum(['PASIEN', 'KELUARGA', 'WALI']),
  method: z.enum(['ELEKTRONIK', 'TULISAN']),
  witnessName: z.string().trim().max(120).optional(),
})

export async function catatPersetujuan(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('consent.kelola')
  const parsed = schema.safeParse({
    patientId: formData.get('patientId'),
    encounterId: formData.get('encounterId') || undefined,
    type: formData.get('type'),
    agreedText: formData.get('agreedText'),
    agreedByName: formData.get('agreedByName'),
    agreedByRole: formData.get('agreedByRole'),
    method: formData.get('method'),
    witnessName: formData.get('witnessName') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data belum lengkap.' }
  const data = parsed.data

  const pasien = await db.patient.findFirst({
    where: { id: data.patientId, organizationId: ctx.organizationId },
  })
  if (!pasien) return { error: 'Pasien tidak ditemukan pada praktik ini.' }

  let encounterId: string | null = null
  if (data.encounterId) {
    const kunjungan = await db.encounter.findFirst({
      where: { id: data.encounterId, organizationId: ctx.organizationId },
    })
    if (!kunjungan) return { error: 'Kunjungan tidak ditemukan.' }
    encounterId = kunjungan.id
  }

  const consent = await db.consentRecord.create({
    data: {
      organizationId: ctx.organizationId,
      patientId: pasien.id,
      encounterId,
      type: data.type,
      agreedText: data.agreedText,
      agreedByName: data.agreedByName,
      agreedByRole: data.agreedByRole,
      method: data.method,
      witnessName: data.witnessName || null,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'CATAT_PERSETUJUAN',
    objectType: 'ConsentRecord',
    objectId: consent.id,
    summary: `Persetujuan ${data.type} dicatat untuk ${pasien.name} oleh ${data.agreedByName}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Persetujuan tercatat.' }
}
