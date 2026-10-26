'use server'

// ============================================================
// MODUL: audit — aksi catat pembukaan jejak audit
// Membuka jejak audit sendiri adalah peristiwa yang diaudit.
// ============================================================

import { requirePermission } from '@/lib/modules/tenant/context'
import { tulisAudit } from './logger'
import { getRequestMeta } from '@/lib/modules/identity_access/session'

export async function catatBukaAudit(): Promise<void> {
  try {
    const ctx = await requirePermission('audit.lihat')
    const { ip, userAgent } = await getRequestMeta()
    await tulisAudit({
      organizationId: ctx.organizationId,
      userId: ctx.auth.userId,
      userLabel: ctx.auth.email,
      roleLabel: ctx.roles.join(', '),
      action: 'LIHAT_AUDIT',
      objectType: 'AuditLog',
      summary: `${ctx.auth.fullName} membuka halaman jejak audit`,
      ipAddress: ip,
      userAgent,
    })
  } catch {
    // perenderan halaman tidak boleh gagal karena pencatatan
  }
}
