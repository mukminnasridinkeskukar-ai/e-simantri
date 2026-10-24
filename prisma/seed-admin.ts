// ============================================================
// e-SIMANTRI — Seed PRODUKSI: bootstrap praktik nyata (Fase 0)
//
// Dipakai SEKALI setelah deploy ke Vercel + Neon untuk membuat:
//   1. Satu organisasi (tempat praktik) dengan data riil Anda
//   2. Satu akun Penanggung Jawab Praktik pertama
//
// JANGAN PERNAH menjalankan prisma/seed.ts (data CONTOH) di
// database produksi.
//
// Cara pakai (lihat DEPLOYMENT.md bagian Langkah 5):
//   DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." \
//   ORG_NAME="Praktik Dokter Anda" \
//   ORG_PRACTICE_TYPE="PRAKTIK_DOKTER" \
//   ORG_SIP_NUMBER="445/1/xxxx/2026" \
//   ORG_OWNER_NAME="dr. Nama Anda" \
//   ADMIN_EMAIL="pj@praktikanda.id" \
//   ADMIN_FULL_NAME="dr. Nama Anda" \
//   ADMIN_PASSWORD="KataSandiKuat123" \
//   bun prisma/seed-admin.ts
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const PRACTICE_TYPES = [
  'PRAKTIK_DOKTER',
  'PRAKTIK_DOKTER_GIGI',
  'PRAKTIK_BIDAN',
  'PRAKTIK_PERAWAT',
  'PRAKTIK_APOTEKER',
  'PRAKTIK_AHLI_GIZI',
  'PRAKTIK_FISIOTERAPI',
  'PRAKTIK_LAINNYA',
]

async function main() {
  const orgName = (process.env.ORG_NAME ?? '').trim()
  const practiceType = (process.env.ORG_PRACTICE_TYPE ?? 'PRAKTIK_DOKTER').trim()
  const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
  const adminFullName = (process.env.ADMIN_FULL_NAME ?? '').trim()
  const adminPassword = process.env.ADMIN_PASSWORD ?? ''

  // ---------- Validasi input ----------
  if (!orgName) throw new Error('ORG_NAME wajib diisi (nama tempat praktik).')
  if (!PRACTICE_TYPES.includes(practiceType))
    throw new Error(`ORG_PRACTICE_TYPE harus salah satu dari: ${PRACTICE_TYPES.join(', ')}.`)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
    throw new Error('ADMIN_EMAIL tidak valid.')
  if (!adminFullName) throw new Error('ADMIN_FULL_NAME wajib diisi.')
  if (adminPassword.length < 8 || !/[a-zA-Z]/.test(adminPassword) || !/[0-9]/.test(adminPassword))
    throw new Error('ADMIN_PASSWORD minimal 8 karakter dan memuat huruf serta angka.')

  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } })
  if (existingAdmin) throw new Error(`Email ${adminEmail} sudah terdaftar. Gunakan email lain.`)

  // ---------- Buat organisasi ----------
  const organization = await db.organization.create({
    data: {
      name: orgName,
      practiceType,
      sipNumber: (process.env.ORG_SIP_NUMBER ?? '').trim() || null,
      ownerName: adminFullName,
      address: (process.env.ORG_ADDRESS ?? '').trim() || null,
      city: (process.env.ORG_CITY ?? '').trim() || null,
      province: (process.env.ORG_PROVINCE ?? '').trim() || null,
      postalCode: (process.env.ORG_POSTAL_CODE ?? '').trim() || null,
      phone: (process.env.ORG_PHONE ?? '').trim() || null,
      email: (process.env.ORG_EMAIL ?? adminEmail).trim() || null,
      status: 'AKTIF',
    },
  })

  // ---------- Buat akun Penanggung Jawab pertama ----------
  const passwordHash = await bcrypt.hash(adminPassword, 10)
  const admin = await db.user.create({
    data: {
      fullName: adminFullName,
      email: adminEmail,
      passwordHash,
      profession: (process.env.ADMIN_PROFESSION ?? '').trim() || null,
      strNumber: (process.env.ADMIN_STR_NUMBER ?? '').trim() || null,
      sipNumber: (process.env.ADMIN_SIP_NUMBER ?? '').trim() || null,
      mustChangePassword: true, // dipaksa mengganti sandi saat pertama kelola akun
      memberships: {
        create: { organizationId: organization.id, role: 'PENANGGUNG_JAWAB' },
      },
    },
  })

  // ---------- Jejak audit inisialisasi ----------
  await db.auditLog.create({
    data: {
      organizationId: organization.id,
      actorUserId: admin.id,
      actorName: admin.fullName,
      action: 'INISIALISASI',
      objectType: 'Organization',
      objectId: organization.id,
      summary: `Praktik "${orgName}" didaftarkan pada e-SIMANTRI Fase 0 beserta akun Penanggung Jawab pertama.`,
      ip: 'seed-admin',
    },
  })

  console.log('Bootstrap produksi selesai:')
  console.log(`- Praktik : ${organization.name} (${organization.id})`)
  console.log(`- Admin   : ${admin.email} — peran Penanggung Jawab Praktik`)
  console.log('- Segera: masuk, ganti kata sandi, aktifkan verifikasi dua langkah (2FA).')
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error('Bootstrap GAGAL:', e instanceof Error ? e.message : e)
    await db.$disconnect()
    process.exit(1)
  })
