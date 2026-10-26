// ============================================================
// MODUL: identity_access — sesi autentikasi
//
// - Kuki httpOnly hanya menyimpan token acak (32 byte); basis data
//   menyimpan SHA-256 dari token tersebut.
// - Sesi kedaluwarsa mutlak 12 jam sejak dibuat.
// - Organisasi aktif disimpan pada sesi di server, tidak pernah
//   dipercaya dari input browser.
// ============================================================

import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'esimantri_sesi'
const SESSION_HOURS = 12

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(input: {
  userId: string
  activeOrganizationId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000)

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: input.userId,
      activeOrganizationId: input.activeOrganizationId ?? null,
      expiresAt,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ? input.userAgent.slice(0, 255) : null,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60,
  })
}

export async function destroyCurrentSession(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  cookieStore.delete(SESSION_COOKIE)
  return token ?? null
}

export async function destroyOtherSessions(userId: string, keepToken: string): Promise<number> {
  const sessions = await db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: { id: true, tokenHash: true },
  })
  const keepHash = hashToken(keepToken)
  const toDelete = sessions.filter((s) => s.tokenHash !== keepHash).map((s) => s.id)
  if (toDelete.length > 0) {
    await db.session.deleteMany({ where: { id: { in: toDelete } } })
  }
  return toDelete.length
}

export async function setActiveOrganization(sessionId: string, organizationId: string | null): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { activeOrganizationId: organizationId },
  })
}

export interface AuthState {
  sessionId: string
  userId: string
  fullName: string
  email: string
  activeOrganizationId: string | null
  loginAt: Date
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
}

/// Membaca dan memvalidasi sesi dari kuki. Aman dipanggil pada server component.
export const getAuthState = cache(async (): Promise<AuthState | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.deleteMany({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  if (!session.user.isActive) return null

  // sentuhan terakhir (non-blocking; kegagalan diabaikan)
  db.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined)

  return {
    sessionId: session.id,
    userId: session.userId,
    fullName: session.user.fullName,
    email: session.user.email,
    activeOrganizationId: session.activeOrganizationId,
    loginAt: session.createdAt,
    expiresAt: session.expiresAt,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
  }
})

export async function getCurrentToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value ?? null
}

export async function getRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers()
    const fwd = h.get('x-forwarded-for')
    const ip = fwd ? fwd.split(',')[0].trim() : h.get('x-real-ip')
    return { ip: ip ?? null, userAgent: h.get('user-agent') }
  } catch {
    return { ip: null, userAgent: null }
  }
}
