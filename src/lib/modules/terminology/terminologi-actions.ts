'use server'

// ============================================================
// MODUL: terminology — kelola kode kustom (Fase 3)
// Bawaan platform bersifat baca-saja; praktik dapat menambah kode
// kustom miliknya (ICD-10 / ICD-9-CM / KFA contoh).
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
  system: z.enum(['ICD10', 'ICD9CM', 'KFA']),
  code: z.string().trim().min(1, 'Kode wajib diisi.').max(40),
  display: z.string().trim().min(2, 'Istilah wajib diisi.').max(200),
  extra: z.string().trim().max(120).optional(),
})

export async function tambahKodeTerminologi(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('terminologi.kelola')
  const parsed = schema.safeParse({
    system: formData.get('system'),
    code: String(formData.get('code') ?? '').toUpperCase(),
    display: formData.get('display'),
    extra: formData.get('extra') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Data belum lengkap.' }

  const ada = await db.terminologyCode.findFirst({
    where: { system: parsed.data.system, code: parsed.data.code, organizationId: ctx.organizationId },
  })
  if (ada) return { error: 'Kode tersebut sudah ada pada daftar kustom praktik ini.' }

  await db.terminologyCode.create({
    data: {
      organizationId: ctx.organizationId,
      system: parsed.data.system,
      code: parsed.data.code,
      display: parsed.data.display,
      extra: parsed.data.extra || null,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'TAMBAH_TERMINOLOGI',
    objectType: 'TerminologyCode',
    summary: `Kode ${parsed.data.system} ${parsed.data.code} ditambahkan ke daftar kustom praktik`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return { success: 'Kode kustom ditambahkan.' }
}
