'use server'

// ============================================================
// MODUL: patient_portal — kode akses & sesi portal (Fase 6)
// - Staf membuat kode 6 digit; basis data menyimpan SHA-256.
//   Kode hanya ditampilkan SEKALI saat dibuat.
// - Pasien masuk dengan kode + tanggal lahir (dd/mm/yyyy).
// - Sesi portal: kuki HMAC pendek (1 jam), terpisah dari sesi staf.
// - Semua upaya masuk (berhasil/gagal) tercatat di jejak audit.
// ============================================================

import 'server-only'
import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { getRequestMeta } from '@/lib/modules/identity_access/session'

const PORTAL_COOKIE = 'esimantri_portal'
const PORTAL_SESSION_HOURS = 1

function hashKode(kode: string): string {
  return createHash('sha256').update(kode).digest('hex')
}

function tandaTangan(nilai: string): string {
  const rahasia = process.env.PORTAL_SESSION_SECRET ?? 'esimantri-demo-secret-ubah-di-produksi'
  return createHmac('sha256', rahasia).update(nilai).digest('hex')
}

export interface AksiStaf {
  error?: string
  success?: string
  kodeBaru?: string
}

/// Staf: buat / atur ulang kode akses portal pasien.
export async function buatKodePortal(_prev: AksiStaf, formData: FormData): Promise<AksiStaf> {
  const ctx = await requirePermission('portal.kelola')
  const patientId = String(formData.get('patientId') ?? '')
  const pasien = await db.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId },
  })
  if (!pasien) return { error: 'Pasien tidak ditemukan.' }
  if (!pasien.dateOfBirth) {
    return { error: 'Pasien belum memiliki tanggal lahir; portal memakai tanggal lahir sebagai verifikasi kedua.' }
  }

  // Kode 6 digit baru; nonaktifkan kode lama.
  const kode = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await db.$transaction([
    db.portalAccess.updateMany({
      where: { patientId: pasien.id, isActive: true },
      data: { isActive: false },
    }),
    db.portalAccess.create({
      data: {
        organizationId: ctx.organizationId,
        patientId: pasien.id,
        codeHash: hashKode(kode),
      },
    }),
  ])

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'PORTAL_KODE',
    objectType: 'PortalAccess',
    objectId: pasien.id,
    summary: `Kode akses portal dibuat/atur ulang untuk ${pasien.name} (${pasien.medicalRecordNumber})`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return {
    success: `Kode akses portal untuk ${pasien.name}: berlaku dengan tanggal lahir sebagai verifikasi. Simpan sekarang — kode tidak ditampilkan lagi.`,
    kodeBaru: kode,
  }
}

/// Portal: masuk dengan kode + tanggal lahir.
export async function masukPortal(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const kode = String(formData.get('kode') ?? '').trim()
  const tanggalLahir = String(formData.get('tanggalLahir') ?? '').trim() // dd/mm/yyyy

  if (!/^\d{6}$/.test(kode) || !/^\d{2}\/\d{2}\/\d{4}$/.test(tanggalLahir)) {
    return { error: 'Masukkan kode 6 angka dan tanggal lahir berformat hh/bb/tttt.' }
  }

  const [dd, bb, tttt] = tanggalLahir.split('/').map((n) => parseInt(n, 10))
  const lahir = new Date(Date.UTC(tttt, bb - 1, dd))

  const akses = await db.portalAccess.findUnique({
    where: { codeHash: hashKode(kode) },
    include: { patient: true, organization: true },
  })

  const { ip, userAgent } = await getRequestMeta()
  const gagal = async (alasan: string) => {
    await tulisAudit({
      organizationId: akses?.organizationId ?? null,
      action: 'PORTAL_LOGIN',
      objectType: 'PortalAccess',
      reason: alasan,
      summary: 'Percobaan masuk portal gagal',
      ipAddress: ip,
      userAgent: userAgent ?? undefined,
    })
    return { error: alasan }
  }

  if (!akses || !akses.isActive) return gagal('Kode akses tidak dikenal atau sudah tidak aktif.')
  if (!akses.patient.dateOfBirth || akses.patient.dateOfBirth.getTime() !== lahir.getTime()) {
    return gagal('Tanggal lahir tidak sesuai dengan berkas pasien.')
  }

  const nilai = `${akses.id}.${Date.now() + PORTAL_SESSION_HOURS * 3600 * 1000}`
  const cookieStore = await cookies()
  cookieStore.set(PORTAL_COOKIE, `${nilai}.${tandaTangan(nilai)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge: PORTAL_SESSION_HOURS * 3600,
  })

  await db.portalAccess.update({ where: { id: akses.id }, data: { lastUsedAt: new Date() } })
  await tulisAudit({
    organizationId: akses.organizationId,
    action: 'PORTAL_LOGIN',
    objectType: 'PortalAccess',
    objectId: akses.id,
    summary: `Pasien ${akses.patient.name} masuk portal`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })
  return {}
}

/// Portal: baca sesi aktif (tanpa membocorkan status ke staf).
export async function sesiPortal(): Promise<{ aksesId: string; patientId: string } | null> {
  const cookieStore = await cookies()
  const mentah = cookieStore.get(PORTAL_COOKIE)?.value
  if (!mentah) return null
  const bagian = mentah.split('.')
  if (bagian.length !== 3) return null
  const [aksesId, exp, ttd] = bagian
  const nilai = `${aksesId}.${exp}`
  const harapan = Buffer.from(tandaTangan(nilai))
  const terima = Buffer.from(ttd)
  if (harapan.length !== terima.length || !timingSafeEqual(harapan, terima)) return null
  if (parseInt(exp, 10) < Date.now()) return null

  const akses = await db.portalAccess.findUnique({
    where: { id: aksesId },
    include: { patient: true },
  })
  if (!akses || !akses.isActive) return null

  return { aksesId: akses.id, patientId: akses.patientId }
}

export async function keluarPortal(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PORTAL_COOKIE)
}

/// Portal: catat akses riwayat (audit per pembukaan).
export async function catatAksesPortal(patientId: string): Promise<void> {
  const sesi = await sesiPortal()
  if (!sesi || sesi.patientId !== patientId) return
  const akses = await db.portalAccess.findUnique({ where: { id: sesi.aksesId }, include: { patient: true } })
  if (!akses) return
  await tulisAudit({
    organizationId: akses.organizationId,
    action: 'PORTAL_AKSES',
    objectType: 'Patient',
    objectId: patientId,
    userLabel: `portal:${akses.patient.medicalRecordNumber}`,
    summary: `Pasien membuka riwayatnya di portal (${akses.patient.name})`,
  })
}
