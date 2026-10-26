'use server'

// ============================================================
// MODUL: identity_access — server actions autentikasi
// (masuk, keluar, pilih praktik, ubah sandi, keluar perangkat lain)
// ============================================================

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { verifyPassword, hashPassword, validatePasswordStrength } from './password'
import {
  createSession,
  destroyCurrentSession,
  destroyOtherSessions,
  getAuthState,
  getCurrentToken,
  getRequestMeta,
  setActiveOrganization,
} from './session'

export interface ActionState {
  error?: string
  success?: string
}

const emailSchema = z.string().trim().toLowerCase().min(5).max(120).regex(
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  'Format surel tidak valid.'
)

// ---------- pembatasan percobaan masuk sederhana (memori proses) ----------
const attemptMap = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function throttleKey(email: string, ip: string | null): string {
  return `${email}::${ip ?? 'tanpa-ip'}`
}

function isThrottled(key: string): boolean {
  const entry = attemptMap.get(key)
  if (!entry) return false
  if (Date.now() > entry.resetAt) {
    attemptMap.delete(key)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

function recordAttempt(key: string): void {
  const entry = attemptMap.get(key)
  if (!entry || Date.now() > entry.resetAt) {
    attemptMap.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS })
  } else {
    entry.count += 1
  }
}

function clearAttempts(key: string): void {
  attemptMap.delete(key)
}

// ---------- MASUK ----------

export async function masuk(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  const password = String(formData.get('password') ?? '')
  if (!parsed.success || password.length === 0) {
    return { error: 'Surel dan kata sandi wajib diisi dengan benar.' }
  }

  const { ip, userAgent } = await getRequestMeta()
  const key = throttleKey(parsed.data, ip)

  if (isThrottled(key)) {
    return { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }
  }

  const user = await db.user.findUnique({ where: { email: parsed.data } })

  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordAttempt(key)
    await tulisAudit({
      action: 'LOGIN_GAGAL',
      userLabel: parsed.data,
      summary: `Percobaan masuk gagal untuk ${parsed.data}`,
      ipAddress: ip,
      userAgent: userAgent ?? undefined,
    })
    return { error: 'Surel atau kata sandi salah.' }
  }

  if (!user.isActive) {
    recordAttempt(key)
    await tulisAudit({
      action: 'LOGIN_GAGAL',
      userId: user.id,
      userLabel: user.email,
      summary: 'Percobaan masuk pada akun yang dinonaktifkan',
      ipAddress: ip,
      userAgent: userAgent ?? undefined,
    })
    return { error: 'Akun ini dinonaktifkan. Hubungi penanggung jawab praktik.' }
  }

  clearAttempts(key)

  // Pilih praktik bawaan: hanya bila tepat satu keanggotaan aktif.
  const memberships = await db.membership.findMany({
    where: { userId: user.id, status: 'AKTIF' },
    include: { organization: { select: { id: true, name: true, status: true } }, roles: true },
  })
  const activeMemberships = memberships.filter((m) => m.organization.status === 'AKTIF')
  const defaultOrg =
    activeMemberships.length === 1
      ? activeMemberships[0].organizationId
      : null

  await createSession({
    userId: user.id,
    activeOrganizationId: defaultOrg,
    ipAddress: ip,
    userAgent,
  })

  await tulisAudit({
    organizationId: defaultOrg,
    userId: user.id,
    userLabel: user.email,
    roleLabel: activeMemberships.map((m) => m.roles.map((r) => r.role).join(', ')).join(' | ') || null,
    action: 'LOGIN',
    objectType: 'Session',
    summary: `${user.fullName} masuk ke aplikasi`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  if (defaultOrg) {
    const orgBawaan = activeMemberships.find((m) => m.organizationId === defaultOrg)
    await tulisAudit({
      organizationId: defaultOrg,
      userId: user.id,
      userLabel: user.email,
      action: 'GANTI_ORGANISASI',
      objectType: 'Organization',
      objectId: defaultOrg,
      summary: `Praktik aktif: ${orgBawaan?.organization.name ?? 'praktik tunggal'}`,
      ipAddress: ip,
      userAgent: userAgent ?? undefined,
    })
    redirect('/beranda')
  }
  redirect('/pilih-praktik')
}

// ---------- KELUAR ----------

export async function keluar(): Promise<void> {
  const auth = await getAuthState()
  const { ip, userAgent } = await getRequestMeta()
  if (auth) {
    await tulisAudit({
      organizationId: auth.activeOrganizationId,
      userId: auth.userId,
      userLabel: auth.email,
      action: 'LOGOUT',
      objectType: 'Session',
      objectId: auth.sessionId,
      summary: `${auth.fullName} keluar dari aplikasi`,
      ipAddress: ip,
      userAgent: userAgent ?? undefined,
    })
  }
  await destroyCurrentSession()
  redirect('/masuk')
}

// ---------- PILIH / PINDAH PRAKTIK ----------

/// Versi formulir biasa (tanpa useActionState) untuk tombol "pindah praktik".
export async function pilihPraktikLangsung(formData: FormData): Promise<void> {
  await pilihPraktik({}, formData)
}

export async function pilihPraktik(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await getAuthState()
  if (!auth) redirect('/masuk')

  const organizationId = String(formData.get('organizationId') ?? '')
  if (!organizationId) return { error: 'Praktik belum dipilih.' }

  const membership = await db.membership.findFirst({
    where: { userId: auth.userId, organizationId, status: 'AKTIF' },
    include: { organization: { select: { name: true, status: true } } },
  })

  if (!membership || membership.organization.status !== 'AKTIF') {
    return { error: 'Anda tidak terdaftar aktif pada praktik tersebut.' }
  }

  const { ip, userAgent } = await getRequestMeta()
  await setActiveOrganization(auth.sessionId, organizationId)
  await tulisAudit({
    organizationId,
    userId: auth.userId,
    userLabel: auth.email,
    action: 'GANTI_ORGANISASI',
    objectType: 'Organization',
    objectId: organizationId,
    summary: `Praktik aktif dipilih: ${membership.organization.name}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  redirect('/beranda')
}

// ---------- UBAH SANDI SENDIRI ----------

export async function ubahSandi(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await getAuthState()
  if (!auth) redirect('/masuk')

  const sandiLama = String(formData.get('sandiLama') ?? '')
  const sandiBaru = String(formData.get('sandiBaru') ?? '')
  const konfirmasi = String(formData.get('konfirmasi') ?? '')

  if (!sandiLama || !sandiBaru || !konfirmasi) {
    return { error: 'Semua kolom kata sandi wajib diisi.' }
  }
  if (sandiBaru !== konfirmasi) {
    return { error: 'Konfirmasi kata sandi baru tidak cocok.' }
  }
  const kelemahan = validatePasswordStrength(sandiBaru)
  if (kelemahan) return { error: kelemahan }

  const user = await db.user.findUnique({ where: { id: auth.userId } })
  if (!user || !verifyPassword(sandiLama, user.passwordHash)) {
    return { error: 'Kata sandi lama salah.' }
  }

  const { ip, userAgent } = await getRequestMeta()
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(sandiBaru) },
  })

  // Sesi lain dimatikan agar sandi lama tidak bisa dipakai di perangkat lain.
  const token = await getCurrentToken()
  if (token) {
    await destroyOtherSessions(user.id, token)
  }

  await tulisAudit({
    organizationId: auth.activeOrganizationId,
    userId: user.id,
    userLabel: user.email,
    action: 'UBAH_SANDI',
    objectType: 'User',
    objectId: user.id,
    summary: 'Kata sandi diubah oleh pemilik akun; sesi lain ditutup',
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return { success: 'Kata sandi berhasil diubah. Perangkat lain telah keluar otomatis.' }
}

// ---------- KELUAR DARI PERANGKAT LAIN ----------

export async function keluarPerangkatLain(): Promise<ActionState> {
  const auth = await getAuthState()
  if (!auth) redirect('/masuk')
  const token = await getCurrentToken()
  if (!token) redirect('/masuk')

  const jumlah = await destroyOtherSessions(auth.userId, token)
  await tulisAudit({
    organizationId: auth.activeOrganizationId,
    userId: auth.userId,
    userLabel: auth.email,
    action: 'LOGOUT',
    objectType: 'Session',
    summary: `Keluar otomatis dari ${jumlah} sesi lain`,
  })
  return { success: jumlah > 0 ? `${jumlah} sesi lain telah ditutup.` : 'Tidak ada sesi lain yang aktif.' }
}


