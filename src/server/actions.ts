'use server'

// ============================================================
// e-SIMANTRI — Server Actions Fase 0 (Fondasi)
// Semua operasi backend lewat sini. Tidak ada route API tambahan.
// Setiap aksi sensitif menulis jejak audit (append-only).
// ============================================================

import bcrypt from 'bcryptjs'
import { generateSecret, generateURI, verifySync } from 'otplib'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import {
  clientMeta,
  createSession,
  clearSessionCookie,
  getAuthState,
  hashPassword,
  readSession,
  requireReadyContext,
  validatePasswordStrength,
  verifyPassword,
} from '@/lib/auth'
import { writeAudit, writeAuditSafe } from '@/lib/audit'
import {
  canGrantRole,
  isRoleKey,
  requiresClinicalCredential,
  type RoleKey,
} from '@/lib/roles'
import type {
  ActionResult,
  AppStatus,
  AuditRowDTO,
  LoginResult,
  OrganizationDTO,
  SessionRowDTO,
  UserRowDTO,
} from '@/lib/dto'

// Hash tiruan untuk menyamakan waktu respons saat email tidak dikenal
// (mengurangi kebocoran informasi lewat perbedaan timing).
const DUMMY_HASH = bcrypt.hashSync('esimantri-dummy-account', 10)

// ------------------------------------------------------------
// Helper internal
// ------------------------------------------------------------

async function finalizeLoginAndPickTenant(sessionId: string, userId: string): Promise<LoginResult> {
  const memberships = await db.membership.findMany({
    where: { userId, isActive: true, organization: { status: 'AKTIF' } },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })

  if (memberships.length === 0) {
    return { ok: true, next: 'no_membership' }
  }

  if (memberships.length === 1) {
    await db.session.update({
      where: { id: sessionId },
      data: { activeMembershipId: memberships[0].id },
    })
    await writeAuditSafe({
      organizationId: memberships[0].organizationId,
      actorUserId: userId,
      action: 'PILIH_PRAKTIK',
      objectType: 'Membership',
      objectId: memberships[0].id,
      summary: `Praktik aktif: ${memberships[0].organization.name}.`,
      sessionId,
    })
    return { ok: true, next: 'ready' }
  }

  return { ok: true, next: 'tenant' }
}

async function requirePersonalContext(): Promise<
  { ok: true; userId: string; sessionId: string; fullName: string } | { ok: false; error: string }
> {
  const state = await getAuthState()
  if (state.status === 'logged_out') {
    return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }
  }
  if (state.status === 'pending_2fa') {
    return { ok: false, error: 'Selesaikan verifikasi dua langkah terlebih dahulu.' }
  }
  const found = await readSession()
  if (!found) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }
  return {
    ok: true,
    userId: found.user.id,
    sessionId: found.session.id,
    fullName: found.user.fullName,
  }
}

async function countActivePJ(organizationId: string): Promise<number> {
  return db.membership.count({
    where: { organizationId, role: 'PENANGGUNG_JAWAB', isActive: true },
  })
}

// ------------------------------------------------------------
// Autentikasi
// ------------------------------------------------------------

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  const normalized = (email ?? '').trim().toLowerCase()
  const meta = await clientMeta()

  if (!normalized || !password) {
    return { ok: false, error: 'Email dan kata sandi wajib diisi.' }
  }

  const user = await db.user.findUnique({ where: { email: normalized } })

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH) // samakan waktu respons
    await writeAuditSafe({
      action: 'MASUK_GAGAL',
      summary: `Percobaan masuk gagal: email tidak dikenal (${normalized}).`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    return { ok: false, error: 'Email atau kata sandi salah.' }
  }

  const passwordOk = await verifyPassword(password, user.passwordHash)

  if (!passwordOk) {
    await writeAuditSafe({
      actorUserId: user.id,
      actorName: user.fullName,
      action: 'MASUK_GAGAL',
      summary: 'Percobaan masuk gagal: kata sandi tidak cocok.',
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    return { ok: false, error: 'Email atau kata sandi salah.' }
  }

  if (!user.isActive) {
    await writeAuditSafe({
      actorUserId: user.id,
      actorName: user.fullName,
      action: 'MASUK_GAGAL',
      summary: 'Percobaan masuk ditolak: akun dinonaktifkan.',
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    return { ok: false, error: 'Akun dinonaktifkan. Hubungi penanggung jawab praktik.' }
  }

  const sessionId = await createSession(user.id, {
    pending2FA: user.totpEnabled,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  if (user.totpEnabled) {
    await writeAuditSafe({
      actorUserId: user.id,
      actorName: user.fullName,
      action: 'MASUK_TAHAP_AWAL',
      summary: 'Kata sandi cocok; menunggu verifikasi dua langkah.',
      ip: meta.ip,
      userAgent: meta.userAgent,
      sessionId,
    })
    return { ok: true, next: '2fa' }
  }

  await writeAuditSafe({
    actorUserId: user.id,
    actorName: user.fullName,
    action: 'MASUK_BERHASIL',
    objectType: 'Session',
    objectId: sessionId,
    summary: 'Masuk berhasil.',
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId,
  })

  return finalizeLoginAndPickTenant(sessionId, user.id)
}

export async function verify2faAction(code: string): Promise<LoginResult> {
  const found = await readSession()
  if (!found) return { ok: false, error: 'Sesi berakhir. Silakan masuk kembali.' }
  const { session, user } = found

  if (!session.pending2FA) {
    return { ok: false, error: 'Tidak ada verifikasi dua langkah yang menunggu.' }
  }

  const meta = await clientMeta()
  const valid = user.totpSecret
    ? verifySync({
        token: (code ?? '').replace(/\s+/g, ''),
        secret: user.totpSecret,
        epochTolerance: 30, // toleransi ±1 langkah waktu (30 detik)
      }).valid
    : false

  if (!valid) {
    await writeAuditSafe({
      actorUserId: user.id,
      actorName: user.fullName,
      action: 'VERIFIKASI_2FA_GAGAL',
      summary: 'Kode verifikasi dua langkah tidak valid.',
      ip: meta.ip,
      userAgent: meta.userAgent,
      sessionId: session.id,
    })
    return { ok: false, error: 'Kode verifikasi tidak valid. Coba lagi.' }
  }

  await db.session.update({
    where: { id: session.id },
    data: { pending2FA: false },
  })

  await writeAuditSafe({
    actorUserId: user.id,
    actorName: user.fullName,
    action: 'VERIFIKASI_2FA_BERHASIL',
    summary: 'Verifikasi dua langkah berhasil.',
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: session.id,
  })
  await writeAuditSafe({
    actorUserId: user.id,
    actorName: user.fullName,
    action: 'MASUK_BERHASIL',
    objectType: 'Session',
    objectId: session.id,
    summary: 'Masuk berhasil (dengan verifikasi dua langkah).',
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: session.id,
  })

  return finalizeLoginAndPickTenant(session.id, user.id)
}

export async function logoutAction(): Promise<ActionResult> {
  const found = await readSession()
  if (found) {
    const meta = await clientMeta()
    let orgId: string | null = null
    if (found.session.activeMembershipId) {
      const m = await db.membership.findUnique({
        where: { id: found.session.activeMembershipId },
        select: { organizationId: true },
      })
      orgId = m?.organizationId ?? null
    }
    await writeAudit({
      organizationId: orgId,
      actorUserId: found.user.id,
      actorName: found.user.fullName,
      action: 'KELUAR',
      objectType: 'Session',
      objectId: found.session.id,
      summary: 'Pengguna keluar dari sesi.',
      ip: meta.ip,
      userAgent: meta.userAgent,
      sessionId: found.session.id,
    })
    await db.session.update({
      where: { id: found.session.id },
      data: { revokedAt: new Date() },
    })
  }
  await clearSessionCookie()
  return { ok: true }
}

export async function getContextAction(): Promise<AppStatus> {
  return getAuthState()
}

export async function switchPraktikAction(membershipId: string): Promise<AppStatus> {
  const found = await readSession()
  if (!found) return { status: 'logged_out' }
  const { session, user } = found
  if (session.pending2FA) return { status: 'pending_2fa', email: user.email }

  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: { organization: true },
  })

  const valid =
    membership &&
    membership.userId === user.id &&
    membership.isActive &&
    membership.organization.status === 'AKTIF'

  if (!valid || !membership) {
    return getAuthState()
  }

  const isFirstSelection = !session.activeMembershipId
  await db.session.update({
    where: { id: session.id },
    data: { activeMembershipId: membership.id },
  })

  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    actorName: user.fullName,
    actorRole: membership.role,
    action: isFirstSelection ? 'PILIH_PRAKTIK' : 'GANTI_PRAKTIK',
    objectType: 'Membership',
    objectId: membership.id,
    summary: isFirstSelection
      ? `Praktik aktif: ${membership.organization.name} (peran ${membership.role}).`
      : `Ganti praktik aktif ke: ${membership.organization.name} (peran ${membership.role}).`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: session.id,
  })

  return getAuthState()
}

// ------------------------------------------------------------
// Profil tempat praktik
// ------------------------------------------------------------

export interface OrgProfileInput {
  name: string
  practiceType: string
  sipNumber?: string
  ownerName?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  phone?: string
  email?: string
  letterheadText?: string
}

export async function updateOrgProfileAction(input: OrgProfileInput): Promise<ActionResult> {
  const guard = await requireReadyContext('praktik.profil.ubah')
  if (!guard.ok) return { ok: false, error: guard.error }

  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Nama praktik wajib diisi.' }

  const clean = (v?: string) => (v ?? '').trim() || null

  await db.organization.update({
    where: { id: guard.state.context.organization.id },
    data: {
      name,
      practiceType: input.practiceType,
      sipNumber: clean(input.sipNumber),
      ownerName: clean(input.ownerName),
      address: clean(input.address),
      city: clean(input.city),
      province: clean(input.province),
      postalCode: clean(input.postalCode),
      phone: clean(input.phone),
      email: clean(input.email),
      letterheadText: clean(input.letterheadText),
    },
  })

  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: guard.state.context.organization.id,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole: guard.state.context.role,
    action: 'PROFIL_PRAKTIK_DIUBAH',
    objectType: 'Organization',
    objectId: guard.state.context.organization.id,
    summary: 'Profil tempat praktik diperbarui.',
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: guard.state.context.membershipId,
  })

  return { ok: true, message: 'Profil praktik tersimpan.' }
}

export async function getOrgProfileAction(): Promise<OrganizationDTO | null> {
  const guard = await requireReadyContext('praktik.profil.lihat')
  if (!guard.ok) return null
  return guard.state.context.organization
}

// ------------------------------------------------------------
// Pengguna & peran dalam praktik
// ------------------------------------------------------------

export async function listUsersAction(): Promise<UserRowDTO[] | null> {
  const guard = await requireReadyContext('pengguna.lihat')
  if (!guard.ok) return null
  const orgId = guard.state.context.organization.id

  const memberships = await db.membership.findMany({
    where: { organizationId: orgId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })

  const userIds = [...new Set(memberships.map((m) => m.userId))]
  const sessions = await db.session.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, createdAt: true },
  })
  const lastSession = new Map<string, Date>()
  for (const s of sessions) {
    if (!lastSession.has(s.userId)) lastSession.set(s.userId, s.createdAt)
  }

  const byUser = new Map<string, UserRowDTO>()
  for (const m of memberships) {
    const existing = byUser.get(m.userId)
    const roleEntry = { membershipId: m.id, role: m.role as RoleKey, isActive: m.isActive }
    if (existing) {
      existing.roles.push(roleEntry)
    } else {
      byUser.set(m.userId, {
        id: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        profession: m.user.profession,
        strNumber: m.user.strNumber,
        isActive: m.user.isActive,
        totpEnabled: m.user.totpEnabled,
        createdAt: m.user.createdAt.toISOString(),
        lastSessionAt: lastSession.get(m.userId)?.toISOString() ?? null,
        roles: [roleEntry],
      })
    }
  }

  return [...byUser.values()]
}

export interface CreateUserInput {
  fullName: string
  email: string
  password: string
  profession?: string
  strNumber?: string
  sipNumber?: string
  role: string
}

export async function createUserAction(input: CreateUserInput): Promise<ActionResult> {
  const guard = await requireReadyContext('pengguna.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const actorRole = guard.state.context.role
  const orgId = guard.state.context.organization.id

  const fullName = (input.fullName ?? '').trim()
  const email = (input.email ?? '').trim().toLowerCase()
  const role = input.role

  if (!fullName) return { ok: false, error: 'Nama lengkap wajib diisi.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Format email tidak valid.' }
  }
  if (!isRoleKey(role)) return { ok: false, error: 'Peran tidak dikenal.' }
  if (!canGrantRole(actorRole, role)) {
    await writeAuditSafe({
      organizationId: orgId,
      actorUserId: guard.state.me.id,
      actorName: guard.state.me.fullName,
      actorRole,
      action: 'AKSES_DITOLAK',
      objectType: 'Membership',
      objectId: role,
      summary: `Percobaan menetapkan peran ${role} oleh peran ${actorRole} ditolak.`,
    })
    return { ok: false, error: 'Peran Anda tidak berhak menetapkan peran tersebut.' }
  }

  const pwError = validatePasswordStrength(input.password ?? '')
  if (pwError) return { ok: false, error: pwError }

  if (requiresClinicalCredential(role)) {
    const profession = (input.profession ?? '').trim()
    const strNumber = (input.strNumber ?? '').trim()
    if (!profession || !strNumber) {
      return {
        ok: false,
        error:
          'Peran klinis wajib melengkapi profesi dan nomor STR/SIP agar penugasan sesuai kewenangan profesi.',
      }
    }
  }

  const existing = await db.user.findUnique({ where: { email } })
  const dupMembership = existing
    ? await db.membership.findFirst({ where: { userId: existing.id, organizationId: orgId, role } })
    : null
  if (dupMembership) {
    return { ok: false, error: 'Pengguna sudah terdaftar dengan peran tersebut di praktik ini.' }
  }

  const meta = await clientMeta()
  if (existing) {
    await db.membership.create({
      data: { userId: existing.id, organizationId: orgId, role },
    })
  } else {
    const passwordHash = await hashPassword(input.password)
    await db.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        profession: (input.profession ?? '').trim() || null,
        strNumber: (input.strNumber ?? '').trim() || null,
        sipNumber: (input.sipNumber ?? '').trim() || null,
        mustChangePassword: true,
        memberships: { create: { organizationId: orgId, role } },
      },
    })
  }

  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole,
    action: 'PENGGUNA_DITAMBAHKAN',
    objectType: 'User',
    objectId: existing?.id ?? null,
    summary: existing
      ? `${fullName} (${email}) ditambahkan ke praktik dengan peran ${role}; akun sudah ada sebelumnya.`
      : `${fullName} (${email}) ditambahkan sebagai pengguna baru dengan peran ${role}.`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: guard.state.context.membershipId,
  })

  return {
    ok: true,
    message: existing
      ? 'Akun sudah ada; keanggotaan praktik ini ditambahkan.'
      : 'Pengguna baru berhasil ditambahkan.',
  }
}

export async function setUserActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  const guard = await requireReadyContext('pengguna.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const orgId = guard.state.context.organization.id

  if (userId === guard.state.me.id) {
    return { ok: false, error: 'Akun sendiri tidak dapat dinonaktifkan dari halaman ini.' }
  }

  const targetMemberships = await db.membership.findMany({
    where: { userId, organizationId: orgId },
  })
  if (targetMemberships.length === 0) {
    return { ok: false, error: 'Pengguna tidak terdaftar di praktik ini.' }
  }

  const hasActivePJ = targetMemberships.some((m) => m.role === 'PENANGGUNG_JAWAB' && m.isActive)
  if (isActive === false && hasActivePJ && (await countActivePJ(orgId)) <= 1) {
    return {
      ok: false,
      error: 'Minimal harus ada satu Penanggung Jawab Praktik yang aktif.',
    }
  }

  await db.user.update({ where: { id: userId }, data: { isActive } })
  if (!isActive) {
    await db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { fullName: true } })
  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole: guard.state.context.role,
    action: isActive ? 'PENGGUNA_DIAKTIFKAN' : 'PENGGUNA_DINONAKTIFKAN',
    objectType: 'User',
    objectId: userId,
    summary: `${target?.fullName ?? userId} ${isActive ? 'diaktifkan' : 'dinonaktifkan'}${
      isActive ? '' : '; seluruh sesinya dicabut.'
    }`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: guard.state.context.membershipId,
  })

  return { ok: true, message: isActive ? 'Pengguna diaktifkan.' : 'Pengguna dinonaktifkan.' }
}

export async function changeMembershipRoleAction(
  membershipId: string,
  newRole: string
): Promise<ActionResult> {
  const guard = await requireReadyContext('pengguna.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const actorRole = guard.state.context.role
  const orgId = guard.state.context.organization.id

  if (!isRoleKey(newRole)) return { ok: false, error: 'Peran tidak dikenal.' }
  if (!canGrantRole(actorRole, newRole)) {
    return { ok: false, error: 'Peran Anda tidak berhak menetapkan peran tersebut.' }
  }

  const membership = await db.membership.findUnique({
    where: { id: membershipId },
    include: { user: true },
  })
  if (!membership || membership.organizationId !== orgId) {
    return { ok: false, error: 'Keanggotaan tidak ditemukan di praktik ini.' }
  }
  if (membership.role === newRole) return { ok: false, error: 'Peran sudah seperti itu.' }

  if (
    membership.role === 'PENANGGUNG_JAWAB' &&
    membership.isActive &&
    newRole !== 'PENANGGUNG_JAWAB' &&
    (await countActivePJ(orgId)) <= 1
  ) {
    return { ok: false, error: 'Minimal harus ada satu Penanggung Jawab Praktik yang aktif.' }
  }

  if (requiresClinicalCredential(newRole)) {
    if (!membership.user.profession || !membership.user.strNumber) {
      return {
        ok: false,
        error:
          'Peran klinis hanya dapat ditetapkan bagi pengguna dengan profesi dan nomor STR/SIP terisi.',
      }
    }
  }

  const oldRole = membership.role
  await db.membership.update({ where: { id: membershipId }, data: { role: newRole } })

  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole,
    action: 'PERAN_KEANGGOTAAN_DIUBAH',
    objectType: 'Membership',
    objectId: membershipId,
    summary: `Peran ${membership.user.fullName} diubah dari ${oldRole} menjadi ${newRole}.`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: guard.state.context.membershipId,
  })

  return { ok: true, message: 'Peran keanggotaan diperbarui.' }
}

// ------------------------------------------------------------
// Jejak audit
// ------------------------------------------------------------

export async function listAuditAction(
  filter: { action?: string; q?: string }
): Promise<AuditRowDTO[] | null> {
  const guard = await requireReadyContext('audit.lihat')
  if (!guard.ok) return null
  const orgId = guard.state.context.organization.id

  const memberUserIds = (
    await db.membership.findMany({
      where: { organizationId: orgId },
      select: { userId: true },
    })
  ).map((m) => m.userId)

  const actionFilter = filter.action && filter.action !== 'SEMUA' ? filter.action : undefined
  const q = (filter.q ?? '').trim()

  const rows = await db.auditLog.findMany({
    where: {
      AND: [
        {
          OR: [
            { organizationId: orgId },
            { organizationId: null, actorUserId: { in: memberUserIds } },
          ],
        },
        ...(actionFilter ? [{ action: actionFilter }] : []),
        ...(q ? [{ OR: [{ summary: { contains: q } }, { actorName: { contains: q } }] }] : []),
      ],
    },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actorName: r.actorName,
    actorRole: r.actorRole,
    action: r.action,
    objectType: r.objectType,
    summary: r.summary,
    ip: r.ip,
    organizationName: r.organization?.name ?? null,
  }))
}

// ------------------------------------------------------------
// Keamanan akun pribadi
// ------------------------------------------------------------

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  const guard = await requirePersonalContext()
  if (!guard.ok) return { ok: false, error: guard.error }

  const user = await db.user.findUnique({ where: { id: guard.userId } })
  if (!user) return { ok: false, error: 'Pengguna tidak ditemukan.' }

  const currentOk = await verifyPassword(current ?? '', user.passwordHash)
  if (!currentOk) return { ok: false, error: 'Kata sandi saat ini salah.' }

  const pwError = validatePasswordStrength(next ?? '')
  if (pwError) return { ok: false, error: pwError }

  const passwordHash = await hashPassword(next)
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  })
  await db.session.updateMany({
    where: { userId: user.id, revokedAt: null, id: { not: guard.sessionId } },
    data: { revokedAt: new Date() },
  })

  const state = await getAuthState()
  const orgId = state.status === 'ready' ? state.context.organization.id : null
  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: user.id,
    actorName: user.fullName,
    action: 'KATA_SANDI_DIUBAH',
    objectType: 'User',
    objectId: user.id,
    summary: 'Kata sandi diubah; sesi perangkat lain dicabut.',
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: guard.sessionId,
  })

  return { ok: true, message: 'Kata sandi berhasil diubah.' }
}

export async function start2faSetupAction(): Promise<
  { ok: true; otpauthUrl: string; qrDataUrl: string; secret: string } | { ok: false; error: string }
> {
  const guard = await requirePersonalContext()
  if (!guard.ok) return { ok: false, error: guard.error }

  const user = await db.user.findUnique({ where: { id: guard.userId } })
  if (!user) return { ok: false, error: 'Pengguna tidak ditemukan.' }
  if (user.totpEnabled) return { ok: false, error: 'Verifikasi dua langkah sudah aktif.' }

  const secret = generateSecret()
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabled: false },
  })

  const otpauthUrl = generateURI({ issuer: 'e-SIMANTRI', label: user.email, secret })
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 })

  const state = await getAuthState()
  const orgId = state.status === 'ready' ? state.context.organization.id : null
  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: user.id,
    actorName: user.fullName,
    action: 'AKUN_2FA_SETUP_DIMULAI',
    objectType: 'User',
    objectId: user.id,
    summary: 'Proses aktivasi verifikasi dua langkah dimulai (belum selesai).',
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: guard.sessionId,
  })

  return { ok: true, otpauthUrl, qrDataUrl, secret }
}

export async function confirm2faAction(code: string): Promise<ActionResult> {
  const guard = await requirePersonalContext()
  if (!guard.ok) return { ok: false, error: guard.error }

  const user = await db.user.findUnique({ where: { id: guard.userId } })
  if (!user) return { ok: false, error: 'Pengguna tidak ditemukan.' }
  if (user.totpEnabled) return { ok: false, error: 'Verifikasi dua langkah sudah aktif.' }
  if (!user.totpSecret) return { ok: false, error: 'Mulai proses aktivasi terlebih dahulu.' }

  const valid = verifySync({
    token: (code ?? '').replace(/\s+/g, ''),
    secret: user.totpSecret,
    epochTolerance: 30,
  }).valid

  if (!valid) {
    const state = await getAuthState()
    const orgId = state.status === 'ready' ? state.context.organization.id : null
    await writeAuditSafe({
      organizationId: orgId,
      actorUserId: user.id,
      actorName: user.fullName,
      action: 'VERIFIKASI_2FA_GAGAL',
      summary: 'Konfirmasi aktivasi verifikasi dua langkah gagal.',
      sessionId: guard.sessionId,
    })
    return { ok: false, error: 'Kode tidak valid. Coba lagi.' }
  }

  await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } })

  const state = await getAuthState()
  const orgId = state.status === 'ready' ? state.context.organization.id : null
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: user.id,
    actorName: user.fullName,
    action: 'AKUN_2FA_DIAKTIFKAN',
    objectType: 'User',
    objectId: user.id,
    summary: 'Verifikasi dua langkah (TOTP) diaktifkan.',
    sessionId: guard.sessionId,
  })

  return { ok: true, message: 'Verifikasi dua langkah aktif.' }
}

export async function disable2faAction(password: string): Promise<ActionResult> {
  const guard = await requirePersonalContext()
  if (!guard.ok) return { ok: false, error: guard.error }

  const user = await db.user.findUnique({ where: { id: guard.userId } })
  if (!user) return { ok: false, error: 'Pengguna tidak ditemukan.' }
  if (!user.totpEnabled) return { ok: false, error: 'Verifikasi dua langkah belum aktif.' }

  const ok = await verifyPassword(password ?? '', user.passwordHash)
  if (!ok) return { ok: false, error: 'Kata sandi salah.' }

  await db.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null },
  })

  const state = await getAuthState()
  const orgId = state.status === 'ready' ? state.context.organization.id : null
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: user.id,
    actorName: user.fullName,
    action: 'AKUN_2FA_DIMATIKAN',
    objectType: 'User',
    objectId: user.id,
    summary: 'Verifikasi dua langkah dimatikan.',
    sessionId: guard.sessionId,
  })

  return { ok: true, message: 'Verifikasi dua langkah dimatikan.' }
}

export async function listSessionsAction(): Promise<SessionRowDTO[] | null> {
  const guard = await requirePersonalContext()
  if (!guard.ok) return null

  const sessions = await db.session.findMany({
    where: { userId: guard.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
  })

  return sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    ip: s.ip,
    userAgent: s.userAgent,
    current: s.id === guard.sessionId,
  }))
}

export async function revokeSessionAction(
  sessionId: string,
  allOthers: boolean
): Promise<ActionResult> {
  const guard = await requirePersonalContext()
  if (!guard.ok) return { ok: false, error: guard.error }

  if (allOthers) {
    const res = await db.session.updateMany({
      where: { userId: guard.userId, revokedAt: null, id: { not: guard.sessionId } },
      data: { revokedAt: new Date() },
    })
    await writeAuditSafe({
      actorUserId: guard.userId,
      actorName: guard.fullName,
      action: 'SESI_DICABUT',
      objectType: 'Session',
      summary: `Mencabut ${res.count} sesi perangkat lain.`,
      sessionId: guard.sessionId,
    })
    return { ok: true, message: `${res.count} sesi lain dicabut.` }
  }

  const target = await db.session.findUnique({ where: { id: sessionId } })
  if (!target || target.userId !== guard.userId) {
    return { ok: false, error: 'Sesi tidak ditemukan.' }
  }
  if (target.id === guard.sessionId) {
    return { ok: false, error: 'Gunakan tombol Keluar untuk mengakhiri sesi saat ini.' }
  }

  await db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
  await writeAuditSafe({
    actorUserId: guard.userId,
    actorName: guard.fullName,
    action: 'SESI_DICABUT',
    objectType: 'Session',
    objectId: sessionId,
    summary: 'Sesi perangkat lain dicabut oleh pemilik akun.',
    sessionId: guard.sessionId,
  })
  return { ok: true, message: 'Sesi dicabut.' }
}
