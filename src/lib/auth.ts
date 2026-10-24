// ============================================================
// e-SIMANTRI — Modul identity_access: autentikasi & sesi (Fase 0)
//
// Prinsip:
// - organization_id selalu berasal dari sesi server yang sudah
//   diautentikasi (Session.activeMembershipId), TIDAK dari browser.
// - Token sesi acak; database hanya menyimpan sha256(token).
// - Sesi kedaluwarsa: batas absolut 12 jam + idle 60 menit.
// - Verifikasi dua langkah (TOTP) tersedia untuk semua pengguna;
//   peran klinis dan penanggung jawab wajib bisa memakainya.
// ============================================================

import 'server-only'

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { cookies, headers } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { writeAuditSafe } from '@/lib/audit'
import { roleHasPermission, type PermissionKey, type RoleKey } from '@/lib/roles'
import type { AppStatus } from '@/lib/dto'

export const SESSION_COOKIE_NAME = 'esimantri_session'
export const SESSION_ABSOLUTE_HOURS = 12
export const SESSION_IDLE_MINUTES = 60

type SessionRow = Prisma.SessionGetPayload<{ include: { user: true } }>

type SessionWithUser = { session: SessionRow; user: SessionRow['user'] }

async function readSessionRow(tokenHash: string): Promise<SessionWithUser | null> {
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  })
  if (!session || session.revokedAt) return null
  if (!session.user) return null
  return { session, user: session.user }
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return 'Kata sandi minimal 8 karakter.'
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw))
    return 'Kata sandi harus memuat huruf dan angka.'
  return null
}

export async function clientMeta(): Promise<{ ip: string; userAgent: string | null }> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'lokal'
  const userAgent = (h.get('user-agent') ?? '').slice(0, 200) || null
  return { ip, userAgent }
}

export function newSessionToken(): string {
  return crypto.randomBytes(48).toString('base64url')
}

// Hanya boleh dipanggil dari Server Action / Route Handler (menulis cookie).
export async function createSession(
  userId: string,
  opts: { pending2FA: boolean; ip: string; userAgent: string | null }
): Promise<string> {
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_HOURS * 3600 * 1000)
  const session = await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      pending2FA: opts.pending2FA,
      expiresAt,
      ip: opts.ip,
      userAgent: opts.userAgent,
    },
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_ABSOLUTE_HOURS * 3600,
  })
  return session.id
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE_NAME)
}

async function revokeSession(sessionId: string, reason: string, userId?: string): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  })
  await writeAuditSafe({
    actorUserId: userId,
    action: reason === 'idle' ? 'SESI_KEDALUWARSA' : 'SESI_DICABUT',
    objectType: 'Session',
    objectId: sessionId,
    summary:
      reason === 'idle'
        ? 'Sesi diakhiri otomatis karena tidak ada aktivitas.'
        : 'Sesi dicabut oleh sistem.',
  })
}

// Baca sesi dari cookie, terapkan kedaluwarsa absolut & idle.
export async function readSession(): Promise<SessionWithUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const found = await readSessionRow(sha256(token))
  if (!found) return null

  const now = Date.now()
  if (found.session.expiresAt.getTime() < now) {
    await revokeSession(found.session.id, 'expired', found.user.id)
    return null
  }
  const idleMs = SESSION_IDLE_MINUTES * 60 * 1000
  if (now - found.session.lastSeenAt.getTime() > idleMs) {
    await revokeSession(found.session.id, 'idle', found.user.id)
    return null
  }
  if (!found.user.isActive) {
    await db.session.update({
      where: { id: found.session.id },
      data: { revokedAt: new Date() },
    })
    return null
  }

  await db.session.update({
    where: { id: found.session.id },
    data: { lastSeenAt: new Date() },
  })
  return found
}

async function listActiveMemberships(userId: string) {
  return db.membership.findMany({
    where: { userId, isActive: true, organization: { status: 'AKTIF' } },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
}

// Susun status aplikasi lengkap — dipakai oleh halaman `/` dan getContextAction.
export async function getAuthState(): Promise<AppStatus> {
  const found = await readSession()
  if (!found) return { status: 'logged_out' }
  const { session, user } = found

  if (session.pending2FA) {
    return { status: 'pending_2fa', email: user.email }
  }

  const memberships = await listActiveMemberships(user.id)
  if (memberships.length === 0) {
    return { status: 'no_membership' }
  }

  const membershipDTOs = memberships.map((m) => ({
    id: m.id,
    role: m.role as RoleKey,
    organizationId: m.organizationId,
    organizationName: m.organization.name,
    organizationStatus: m.organization.status,
  }))

  const me = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    profession: user.profession,
    totpEnabled: user.totpEnabled,
  }

  const active = session.activeMembershipId
    ? memberships.find((m) => m.id === session.activeMembershipId)
    : undefined
  if (!active) {
    return { status: 'pick_tenant', me, memberships: membershipDTOs }
  }

  return {
    status: 'ready',
    me,
    memberships: membershipDTOs,
    context: {
      membershipId: active.id,
      role: active.role as RoleKey,
      organization: {
        id: active.organization.id,
        name: active.organization.name,
        practiceType: active.organization.practiceType,
        sipNumber: active.organization.sipNumber,
        ownerName: active.organization.ownerName,
        address: active.organization.address,
        city: active.organization.city,
        province: active.organization.province,
        postalCode: active.organization.postalCode,
        phone: active.organization.phone,
        email: active.organization.email,
        letterheadText: active.organization.letterheadText,
        status: active.organization.status,
        updatedAt: active.organization.updatedAt.toISOString(),
      },
    },
  }
}

export type ReadyState = Extract<AppStatus, { status: 'ready' }>

// Penjaga akses untuk Server Actions: wajib sesi siap + izin memadai.
// Akses ditolak selalu dicatat pada jejak audit.
export async function requireReadyContext(
  permission?: PermissionKey
): Promise<{ ok: true; state: ReadyState } | { ok: false; error: string }> {
  const state = await getAuthState()
  if (state.status === 'logged_out') {
    return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }
  }
  if (state.status === 'pending_2fa') {
    return { ok: false, error: 'Selesaikan verifikasi dua langkah terlebih dahulu.' }
  }
  if (state.status !== 'ready') {
    return { ok: false, error: 'Pilih praktik aktif terlebih dahulu.' }
  }
  if (permission && !roleHasPermission(state.context.role, permission)) {
    const meta = await clientMeta()
    await writeAuditSafe({
      organizationId: state.context.organization.id,
      actorUserId: state.me.id,
      actorName: state.me.fullName,
      actorRole: state.context.role,
      action: 'AKSES_DITOLAK',
      objectType: 'Permission',
      objectId: permission,
      summary: `Akses ditolak untuk izin "${permission}" dengan peran ${state.context.role}.`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    return { ok: false, error: 'Anda tidak memiliki izin untuk aksi ini.' }
  }
  return { ok: true, state }
}
