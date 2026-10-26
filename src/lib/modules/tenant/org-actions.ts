'use server'

// ============================================================
// MODUL: tenant — server actions profil tempat praktik
// Hanya Penanggung Jawab Praktik yang boleh mengubah profil.
// ============================================================

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from './context'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import type { ActionState } from '@/lib/modules/identity_access/actions'

const JENIS_PRAKTIK = ['DOKTER_UMUM', 'DOKTER_GIGI', 'NAKES_LAIN', 'CAMPURAN'] as const

const profilSchema = z.object({
  name: z.string().trim().min(3, 'Nama praktik minimal 3 karakter.').max(160),
  practiceType: z.enum(['DOKTER_UMUM', 'DOKTER_GIGI', 'NAKES_LAIN', 'CAMPURAN']),
  sipNumber: z.string().trim().max(80).optional().or(z.literal('')),
  address: z.string().trim().max(400).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().max(120).optional().or(z.literal('')),
  headName: z.string().trim().max(120).optional().or(z.literal('')),
})

export async function ubahProfilPraktik(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission('profil_praktik.ubah')

  const parsed = profilSchema.safeParse({
    name: formData.get('name'),
    practiceType: formData.get('practiceType'),
    sipNumber: formData.get('sipNumber') ?? '',
    address: formData.get('address') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    headName: formData.get('headName') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }
  }

  const sebelum = await db.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { name: true, practiceType: true, sipNumber: true, address: true, phone: true, email: true, headName: true },
  })

  await db.organization.update({
    where: { id: ctx.organizationId },
    data: {
      name: parsed.data.name,
      practiceType: parsed.data.practiceType,
      sipNumber: parsed.data.sipNumber || null,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      headName: parsed.data.headName || null,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  const berubah: string[] = []
  if (sebelum) {
    for (const k of ['name', 'practiceType', 'sipNumber', 'address', 'phone', 'email', 'headName'] as const) {
      if ((sebelum[k] ?? '') !== (parsed.data[k] || null)) berubah.push(k)
    }
  }

  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'UBAH_PROFIL_PRAKTIK',
    objectType: 'Organization',
    objectId: ctx.organizationId,
    summary: `${ctx.auth.fullName} mengubah profil praktik (kolom: ${berubah.join(', ') || '—'})`,
    detail: { kolomBerubah: berubah },
    ipAddress: ip,
    userAgent,
  })

  revalidatePath('/profil-praktik')
  revalidatePath('/beranda')
  return { success: 'Profil praktik berhasil disimpan.' }
}
