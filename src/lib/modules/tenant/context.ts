// ============================================================
// MODUL: tenant — konteks organisasi aktif & penjaga akses
//
// Aturan inti: seluruh akses data terlingkup organization_id yang
// berasal dari SESI TERAUTENTIKASI di server, tidak pernah dari
// parameter browser.
// ============================================================

import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from '@/lib/db'
import { getAuthState, type AuthState } from '@/lib/modules/identity_access/session'
import { hasPermission, type Permission, type Role } from '@/lib/modules/identity_access/roles'

export interface MembershipSummary {
  membershipId: string
  organizationId: string
  organizationName: string
  organizationStatus: string
  isSample: boolean
  status: string
  roles: Role[]
  joinedAt: Date
}

export interface OrgContext {
  auth: AuthState
  organizationId: string
  organizationName: string
  isSample: boolean
  membershipId: string
  roles: Role[]
}

/// Memastikan pengguna sudah masuk. Bila belum → /masuk.
export async function requireAuth(): Promise<AuthState> {
  const auth = await getAuthState()
  if (!auth) redirect('/masuk')
  return auth
}

/// Memastikan pengguna sudah masuk DAN memiliki organisasi aktif yang sah.
export async function requireOrg(): Promise<OrgContext> {
  const auth = await requireAuth()

  if (!auth.activeOrganizationId) redirect('/pilih-praktik')

  const membership = await db.membership.findFirst({
    where: {
      userId: auth.userId,
      organizationId: auth.activeOrganizationId,
      status: 'AKTIF',
    },
    include: {
      organization: { select: { id: true, name: true, isSample: true, status: true } },
      roles: true,
    },
  })

  // Keanggotaan sudah tidak aktif → paksa memilih ulang praktik.
  if (!membership) redirect('/pilih-praktik')

  return {
    auth,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    isSample: membership.organization.isSample,
    membershipId: membership.id,
    roles: membership.roles.map((r) => r.role as Role),
  }
}

/// Memastikan pengguna memiliki izin tertentu pada organisasi aktif.
export async function requirePermission(permission: Permission): Promise<OrgContext> {
  const ctx = await requireOrg()
  if (!hasPermission(ctx.roles, permission)) {
    redirect('/beranda?akses=ditolak')
  }
  return ctx
}

/// Daftar keanggotaan aktif pengguna (untuk pemilih praktik & halaman akun).
export const listMemberships = cache(async (userId: string): Promise<MembershipSummary[]> => {
  const rows = await db.membership.findMany({
    where: { userId, status: 'AKTIF' },
    include: {
      organization: { select: { id: true, name: true, status: true, isSample: true } },
      roles: true,
    },
    orderBy: { joinedAt: 'asc' },
  })
  return rows.map((m) => ({
    membershipId: m.id,
    organizationId: m.organization.id,
    organizationName: m.organization.name,
    organizationStatus: m.organization.status,
    isSample: m.organization.isSample,
    status: m.status,
    roles: m.roles.map((r) => r.role as Role),
    joinedAt: m.joinedAt,
  }))
})
