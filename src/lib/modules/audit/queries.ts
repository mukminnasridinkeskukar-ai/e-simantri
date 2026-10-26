// ============================================================
// MODUL: audit — kueri pembaca jejak audit (read-only)
// Lingkup: organisasi aktif + peristiwa login/keluar milik anggota
// organisasi tersebut. Tidak ada jalur ubah/hapus.
// ============================================================

import { db } from '@/lib/db'
import type { AuditAction } from './logger'

export interface AuditFilter {
  action?: string
  q?: string
  periode?: 'hari-ini' | '7-hari' | '30-hari' | 'semua'
  page?: number
}

const PAGE_SIZE = 20

export async function queryAudit(organizationId: string, filter: AuditFilter) {
  const memberIds = await db.membership.findMany({
    where: { organizationId },
    select: { userId: true },
  })
  const memberUserIdList = memberIds.map((m) => m.userId)

  const now = new Date()
  let since: Date | null = null
  if (filter.periode === 'hari-ini') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (filter.periode === '7-hari') {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (filter.periode === '30-hari') {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  const where = {
    OR: [
      { organizationId },
      { organizationId: null, userId: { in: memberUserIdList }, action: { in: ['LOGIN', 'LOGIN_GAGAL', 'LOGOUT'] } },
    ],
    ...(filter.action ? { action: filter.action } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filter.q
      ? {
          OR: [
            { summary: { contains: filter.q } },
            { userLabel: { contains: filter.q } },
            { action: { contains: filter.q.toUpperCase() } },
          ],
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: ((filter.page ?? 1) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  return {
    total,
    pageSize: PAGE_SIZE,
    page: filter.page ?? 1,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows,
  }
}

export async function countAudit30Hari(organizationId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return db.auditLog.count({ where: { organizationId, createdAt: { gte: since } } })
}

export function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    LOGIN: 'Masuk akun',
    LOGIN_GAGAL: 'Percobaan masuk gagal',
    LOGOUT: 'Keluar akun',
    GANTI_ORGANISASI: 'Pilih / pindah praktik aktif',
    TAMBAH_PENGGUNA: 'Tambah pengguna pada praktik',
    UBAH_PERAN: 'Ubah peran pengguna',
    STATUS_PENGGUNA: 'Aktifkan / nonaktifkan pengguna',
    RESET_SANDI: 'Atur ulang kata sandi pengguna',
    UBAH_SANDI: 'Ubah kata sandi sendiri',
    UBAH_PROFIL_PRAKTIK: 'Ubah profil tempat praktik',
    LIHAT_AUDIT: 'Membuka jejak audit',
  }
  return labels[action as AuditAction] ?? action
}
