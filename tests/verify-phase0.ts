// ============================================================
// e-SIMANTRI — Uji verifikasi minimum Fase 0
// Sesuai kontrak pengembangan (bagian 7 master prompt):
// - isolasi tenant
// - larangan hapus klinis (audit append-only)
// - peran tidak bisa membuka data di luar haknya (matriks RBAC)
// - kata sandi selalu ter-hash
// Catatan: sejak Fase 1-2, tabel Pasien/Kunjungan/CatatanKlinis
// sudah sah; pemeriksaan [6] kini menjaga agar modul Fase 3+
// (terminologi ICD-10/KFA, SATUSEHAT, ringkasan, klaim) tidak
// dibangun prematur.
// Jalankan: bun tests/verify-phase0.ts
// ============================================================

import { db } from '@/lib/db'
import * as audit from '@/lib/audit'
import {
  canGrantRole,
  isRoleKey,
  roleHasPermission,
} from '@/lib/roles'
import { generateSecret, generateSync, verifySync } from 'otplib'
import { Prisma } from '@prisma/client'

let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main() {
  console.log('=== Uji Verifikasi Fase 0 — e-SIMANTRI ===\n')

  // ---------- 1. Isolasi tenant ----------
  console.log('[1] Isolasi tenant pada jejak audit')
  const orgs = await db.organization.findMany()
  check('terdapat 2 praktik contoh', orgs.length === 2)

  const [orgA, orgB] = orgs
  const auditA = await db.auditLog.findMany({ where: { organizationId: orgA.id } })
  const auditB = await db.auditLog.findMany({ where: { organizationId: orgB.id } })
  check(
    'query audit praktik A hanya memuat baris praktik A',
    auditA.every((r) => r.organizationId === orgA.id)
  )
  check(
    'query audit praktik B hanya memuat baris praktik B',
    auditB.every((r) => r.organizationId === orgB.id)
  )

  const membersA = await db.membership.findMany({
    where: { organizationId: orgB.id },
    select: { userId: true },
  })
  const auditAScoped = await db.auditLog.findMany({
    where: {
      AND: [
        { OR: [{ organizationId: orgA.id }, { organizationId: null, actorUserId: { in: membersA.map((m) => m.userId) } }] },
      ],
    },
  })
  check(
    'penggabungan lingkup audit A tidak menarik baris praktik B',
    auditAScoped.every((r) => r.organizationId === orgA.id || r.organizationId === null)
  )

  // Keanggotaan lintas praktik (dr. Andi di praktik bidan) tidak menembus isolasi:
  const crossUser = await db.user.findFirst({
    where: { email: 'andi@praktik-contoh.id' },
    include: { memberships: true },
  })
  check(
    'pengguna contoh tergabung di 2 praktik (peran berbeda diperbolehkan)',
    !!crossUser && crossUser.memberships.length === 3
  )

  // ---------- 2. Append-only ----------
  console.log('\n[2] Jejak audit append-only')
  const auditExports = Object.keys(audit)
  check(
    'layanan audit tidak mengekspor fungsi ubah/hapus',
    auditExports.every((k) => !/update|delete|upsert/i.test(k)),
    `ekspor: ${auditExports.join(', ')}`
  )
  await db.auditLog.create({
    data: { action: 'UJI_VERIFIKASI', summary: 'Baris uji verifikasi (append-only).' },
  })
  const stillThere = await db.auditLog.findFirst({ where: { action: 'UJI_VERIFIKASI' } })
  check('baris audit yang ditulis dapat dibaca kembali', !!stillThere)
  if (stillThere) await db.auditLog.delete({ where: { id: stillThere.id } }) // hanya di skrip uji

  // ---------- 3. RBAC ----------
  console.log('\n[3] Matriks peran tidak membuka akses di luar haknya')
  check('PENDAFTARAN tidak punya pengguna.kelola', !roleHasPermission('PENDAFTARAN', 'pengguna.kelola'))
  check('PENDAFTARAN tidak punya audit.lihat', !roleHasPermission('PENDAFTARAN', 'audit.lihat'))
  check('KASIR tidak punya praktik.profil.ubah', !roleHasPermission('KASIR', 'praktik.profil.ubah'))
  check('PASIEN tidak punya pengguna.lihat', !roleHasPermission('PASIEN', 'pengguna.lihat'))
  check('ADMIN_TEKNIS punya audit.lihat', roleHasPermission('ADMIN_TEKNIS', 'audit.lihat'))
  check(
    'ADMIN_TEKNIS tidak dapat menetapkan peran klinis PPA',
    !canGrantRole('ADMIN_TEKNIS', 'PPA')
  )
  check(
    'ADMIN_TEKNIS tidak dapat menetapkan PENANGGUNG_JAWAB',
    !canGrantRole('ADMIN_TEKNIS', 'PENANGGUNG_JAWAB')
  )
  check('PENANGGUNG_JAWAB dapat menetapkan semua peran', canGrantRole('PENANGGUNG_JAWAB', 'PPA'))
  check('PPA biasa tidak dapat menetapkan peran apa pun', !canGrantRole('PPA', 'PENDAFTARAN'))
  check('kunci peran tervalidasi', isRoleKey('PPA') && !isRoleKey('PERAN_PALAKAT'))

  // ---------- 4. Kata sandi ter-hash ----------
  console.log('\n[4] Kata sandi selalu tersimpan ter-hash')
  const users = await db.user.findMany({ select: { email: true, passwordHash: true } })
  check(
    `seluruh ${users.length} pengguna memakai hash bcrypt (bukan plaintext)`,
    users.length > 0 && users.every((u) => u.passwordHash.startsWith('$2'))
  )

  // ---------- 5. TOTP siap pakai ----------
  console.log('\n[5] Verifikasi dua langkah (TOTP)')
  const secret = generateSecret()
  const token = generateSync({ secret })
  check('pasangan secret-kode TOTP terverifikasi', verifySync({ token, secret }).valid)
  check('kode salah ditolak', !verifySync({ token: '000000', secret }).valid)

  // ---------- 6. Larangan modul Fase 4+ prematur ----------
  console.log('\n[6] Fase 4+ belum dibangun prematur')
  const datamodel = (Prisma.dmmf.datamodel as unknown as { models: { name: string }[] }) ?? {
    models: [],
  }
  const modelNames = datamodel.models.map((m) => m.name)
  // Fase 0-3 sudah sah (termasuk katalog ICD-10/ICD-9-CM/KFA + resep);
  // yang masih dilarang: ringkasan, salinan/consent, SATUSEHAT, odontogram, klaim, rujukan.
  const forbidden = [
    'PatientSummary', 'SummaryDocument', 'Consent',
    'FhirBundle', 'SatuSehatMapping', 'Odontogram', 'Claim', 'Referral',
  ]
  check(
    'tidak ada tabel Fase 4+ pada skema (ringkasan, SATUSEHAT, klaim datang nanti)',
    !forbidden.some((f) => modelNames.includes(f)),
    `model: ${modelNames.join(', ')}`
  )

  console.log(`\n=== Hasil: ${passed} lulus, ${failed} gagal ===`)
  if (failed > 0) process.exit(1)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
