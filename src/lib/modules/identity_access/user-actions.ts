'use server'

// ============================================================
// MODUL: identity_access — server actions pengelolaan pengguna praktik
// Semua aksi hanya untuk Penanggung Jawab Praktik, berjalan pada
// organisasi dari sesi, dan seluruhnya menulis jejak audit.
//
// Aturan anti-terkunci (anti-lockout):
// - Tidak boleh mengubah peran/status keanggotaan sendiri.
// - Tidak boleh menonaktifkan anggota, mencabut peran Penanggung Jawab,
//   atau menonaktifkan akun milik Penanggung Jawab aktif terakhir.
// ============================================================

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { hashPassword, validatePasswordStrength } from './password'
import { getRequestMeta } from './session'
import { ROLES, type Role } from './roles'
import type { ActionState } from './actions'

function parseRoles(formData: FormData): Role[] {
  const roles = formData
    .getAll('roles')
    .map((r) => String(r))
    .filter((r): r is Role => (ROLES as readonly string[]).includes(r))
  return Array.from(new Set(roles))
}

async function countActivePJ(organizationId: string, excludeMembershipId?: string): Promise<number> {
  const pjMemberships = await db.membership.findMany({
    where: {
      organizationId,
      status: 'AKTIF',
      ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {}),
    },
    select: { id: true, roles: { select: { role: true } } },
  })
  return pjMemberships.filter((m) => m.roles.some((r) => r.role === 'PENANGGUNG_JAWAB')).length
}

async function lastActivePJGuard(organizationId: string, targetMembershipId: string): Promise<string | null> {
  const target = await db.membership.findUnique({
    where: { id: targetMembershipId },
    include: { roles: true },
  })
  if (!target) return 'Keanggotaan tidak ditemukan.'
  const isPJ = target.roles.some((r) => r.role === 'PENANGGUNG_JAWAB')
  if (!isPJ) return null
  const otherPJ = await countActivePJ(organizationId, targetMembershipId)
  if (otherPJ === 0) {
    return 'Tidak boleh: ini satu-satunya Penanggung Jawab Praktik yang aktif.'
  }
  return null
}

// ---------- TAMBAH PENGGUNA ----------

const tambahSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(120),
  email: z.string().trim().toLowerCase().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Format surel tidak valid.'),
  profession: z.string().trim().max(60).optional().or(z.literal('')),
  strNumber: z.string().trim().max(60).optional().or(z.literal('')),
  sipNumber: z.string().trim().max(60).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  password: z.string().min(1, 'Kata sandi awal wajib diisi.'),
})

export async function tambahPengguna(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission('pengguna.kelola')
  const { ip, userAgent } = await getRequestMeta()

  const parsed = tambahSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    profession: formData.get('profession') ?? '',
    strNumber: formData.get('strNumber') ?? '',
    sipNumber: formData.get('sipNumber') ?? '',
    phone: formData.get('phone') ?? '',
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }
  }
  const roles = parseRoles(formData)
  if (roles.length === 0) {
    return { error: 'Pilih sedikitnya satu peran.' }
  }
  const kelemahan = validatePasswordStrength(parsed.data.password)
  if (kelemahan) return { error: kelemahan }

  let user = await db.user.findUnique({ where: { email: parsed.data.email } })
  const akunBaru = !user

  if (!user) {
    user = await db.user.create({
      data: {
        email: parsed.data.email,
        passwordHash: hashPassword(parsed.data.password),
        fullName: parsed.data.fullName,
        profession: parsed.data.profession || null,
        strNumber: parsed.data.strNumber || null,
        sipNumber: parsed.data.sipNumber || null,
        phone: parsed.data.phone || null,
      },
    })
  } else {
    const sudah = await db.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: ctx.organizationId } },
    })
    if (sudah) {
      return { error: 'Pengguna ini sudah terdaftar pada praktik ini.' }
    }
    // Akun lama dipakai ulang: identitas diperbarui hanya bila kolomnya kosong.
    await db.user.update({
      where: { id: user.id },
      data: {
        fullName: parsed.data.fullName,
        profession: parsed.data.profession || undefined,
        strNumber: parsed.data.strNumber || undefined,
        sipNumber: parsed.data.sipNumber || undefined,
        phone: parsed.data.phone || undefined,
      },
    })
  }

  const membership = await db.membership.create({
    data: {
      userId: user.id,
      organizationId: ctx.organizationId,
      status: 'AKTIF',
      roles: { create: roles.map((role) => ({ role })) },
    },
  })

  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'TAMBAH_PENGGUNA',
    objectType: 'Membership',
    objectId: membership.id,
    summary: `${ctx.auth.fullName} menambahkan ${user.fullName} (${user.email}) dengan peran: ${roles.join(', ')}`,
    detail: { akunBaru, peran: roles, profesi: parsed.data.profession || null },
    ipAddress: ip,
    userAgent,
  })

  revalidatePath('/pengguna')
  return { success: `${user.fullName} ditambahkan ke praktik.` }
}

// ---------- UBAH PERAN ----------

export async function ubahPeranPengguna(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission('pengguna.kelola')
  const membershipId = String(formData.get('membershipId') ?? '')
  const nama = String(formData.get('nama') ?? '(tanpa nama)')

  if (membershipId === ctx.membershipId) {
    return { error: 'Tidak boleh mengubah peran akun sendiri.' }
  }

  const roles = parseRoles(formData)
  if (roles.length === 0) {
    return { error: 'Pilih sedikitnya satu peran.' }
  }

  const existing = await db.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.organizationId },
    include: { roles: true, user: { select: { fullName: true } } },
  })
  if (!existing) return { error: 'Keanggotaan tidak ditemukan pada praktik ini.' }

  const sebelum = existing.roles.map((r) => r.role)
  const mencabutPJ = sebelum.includes('PENANGGUNG_JAWAB') && !roles.includes('PENANGGUNG_JAWAB')
  if (mencabutPJ && existing.status === 'AKTIF') {
    const guard = await lastActivePJGuard(ctx.organizationId, membershipId)
    if (guard) return { error: guard }
  }

  await db.$transaction([
    db.membershipRole.deleteMany({ where: { membershipId } }),
    db.membershipRole.createMany({ data: roles.map((role) => ({ membershipId, role })) }),
  ])

  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'UBAH_PERAN',
    objectType: 'Membership',
    objectId: membershipId,
    summary: `${ctx.auth.fullName} mengubah peran ${existing.user.fullName}: ${sebelum.join(', ') || '—'} → ${roles.join(', ')}`,
    detail: { sebelum, sesudah: roles },
  })

  revalidatePath('/pengguna')
  return { success: `Peran ${nama} diperbarui.` }
}

// ---------- AKTIF / NONAKTIF ----------

export async function ubahStatusPengguna(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission('pengguna.kelola')
  const membershipId = String(formData.get('membershipId') ?? '')
  const statusBaru = String(formData.get('status') ?? '')

  if (!['AKTIF', 'NONAKTIF'].includes(statusBaru)) {
    return { error: 'Status tidak valid.' }
  }
  if (membershipId === ctx.membershipId) {
    return { error: 'Tidak boleh mengubah status keanggotaan sendiri.' }
  }

  const existing = await db.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.organizationId },
    include: { roles: true, user: { select: { fullName: true, isActive: true } } },
  })
  if (!existing) return { error: 'Keanggotaan tidak ditemukan pada praktik ini.' }

  if (statusBaru === 'NONAKTIF') {
    const guard = await lastActivePJGuard(ctx.organizationId, membershipId)
    if (guard) return { error: guard }
  }

  await db.membership.update({ where: { id: membershipId }, data: { status: statusBaru } })

  // Nonaktif keanggotaan juga menonaktifkan sesi yang memakai praktik ini.
  if (statusBaru === 'NONAKTIF') {
    await db.session.updateMany({
      where: { userId: existing.userId, activeOrganizationId: ctx.organizationId },
      data: { activeOrganizationId: null },
    })
  }

  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_PENGGUNA',
    objectType: 'Membership',
    objectId: membershipId,
    summary: `${ctx.auth.fullName} mengubah status ${existing.user.fullName}: ${existing.status} → ${statusBaru}`,
    detail: { sebelum: existing.status, sesudah: statusBaru },
  })

  revalidatePath('/pengguna')
  return { success: `Status ${existing.user.fullName} diperbarui.` }
}

// ---------- ATUR ULANG SANDI ----------

export async function resetSandiPengguna(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission('pengguna.kelola')
  const membershipId = String(formData.get('membershipId') ?? '')
  const sandiBaru = String(formData.get('sandiBaru') ?? '')

  const kelemahan = validatePasswordStrength(sandiBaru)
  if (kelemahan) return { error: kelemahan }

  const existing = await db.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.organizationId },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  })
  if (!existing) return { error: 'Keanggotaan tidak ditemukan pada praktik ini.' }

  await db.user.update({
    where: { id: existing.user.id },
    data: { passwordHash: hashPassword(sandiBaru) },
  })
  // Tutup semua sesi pengguna tersebut agar sandi lama tak berlaku.
  await db.session.deleteMany({ where: { userId: existing.user.id } })

  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'RESET_SANDI',
    objectType: 'User',
    objectId: existing.user.id,
    summary: `${ctx.auth.fullName} mengatur ulang kata sandi ${existing.user.fullName} (${existing.user.email}); seluruh sesinya ditutup`,
  })

  revalidatePath('/pengguna')
  return { success: `Kata sandi ${existing.user.fullName} diatur ulang.` }
}
