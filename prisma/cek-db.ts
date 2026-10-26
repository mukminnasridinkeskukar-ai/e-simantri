// ============================================================
// e-SIMANTRI — Pemeriksa isi database (HANYA-BACA, aman dijalankan kapan pun)
//
// Menjawab pertanyaan umum: "Kenapa tabel User di Neon kosong?"
// Menampilkan: host tujuan koneksi (tanpa kredensial), jumlah baris
// tiap tabel, penanda data CONTOH, dan petunjuk langkah berikutnya.
//
// Cara pakai (dari folder proyek; .env menunjuk database yang mau dicek):
//   bun run db:cek          # atau: npx tsx prisma/cek-db.ts
// ============================================================

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const TABEL_UTAMA = [
  'Organization',
  'User',
  'Membership',
  'Session',
  'AuditLog',
  'Patient',
  'Encounter',
  'ClinicalNote',
  'ClinicalNoteVersion',
  'Icd10Code',
  'Icd9CmCode',
  'KfaCode',
  'NoteDiagnosis',
  'NoteProcedure',
  'Prescription',
  'PrescriptionItem',
] as const

async function hitung(tabel: string): Promise<number | null> {
  try {
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM "${tabel}"`,
    )
    return rows[0]?.n ?? null
  } catch {
    return null // tabel belum ada
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL belum terisi.')
    console.log('Salin .env.example menjadi .env, lalu isi string koneksi Neon Anda')
    console.log('(pooled untuk DATABASE_URL, direct untuk DIRECT_URL).')
    return
  }

  // — Ke mana koneksi ini menuju? (tanpa menampilkan kredensial) —
  let host = '(tidak terbaca)'
  let dbName = '?'
  try {
    const u = new URL(process.env.DATABASE_URL)
    host = u.hostname
    dbName = u.pathname.replace(/^\//, '') || '?'
  } catch {
    /* abaikan */
  }

  console.log('e-SIMANTRI — Cek isi database (hanya-baca)')
  console.log(`Host     : ${host}${host.includes('-pooler') ? '  (pooled)' : ''}`)
  console.log(`Database : ${dbName}`)
  console.log('')

  // — Uji konektivitas dulu agar "server mati" tidak dikira "tabel kosong" —
  try {
    await db.$queryRawUnsafe('SELECT 1')
  } catch (e) {
    const kode = (e as { code?: string })?.code
    console.log('GAGAL TERHUBUNG ke database ini.')
    if (kode === 'P1001') {
      console.log('  (P1001) Server tidak terjangkau. Periksa:')
      console.log('  - DATABASE_URL benar & memakai host "-pooler" untuk runtime')
      console.log('  - "?sslmode=require" masih ada pada string koneksi')
      console.log('  - Proyek/branch Neon sudah aktif (tunggu 1-2 menit bila baru dibuat)')
    } else {
      console.log(`  ${e instanceof Error ? e.message : e}`)
      console.log('  Pastikan .env berisi DATABASE_URL dan DIRECT_URL yang valid.')
    }
    return
  }

  const jumlah: Record<string, number | null> = {}
  for (const t of TABEL_UTAMA) jumlah[t] = await hitung(t)

  const ada: [string, number][] = []
  const hilang: string[] = []
  for (const t of TABEL_UTAMA) {
    const n = jumlah[t]
    if (n === null) hilang.push(t)
    else ada.push([t, n])
  }

  if (ada.length === 0) {
    console.log('BELUM ADA tabel e-SIMANTRI di database ini.')
    console.log('  -> Jalankan migrasi : bun run db:deploy')
    console.log('     (pastikan .env berisi string koneksi Neon yang benar,')
    console.log('      dan Anda mengecek branch/database yang sama di Neon Console)')
  } else {
    console.log('Jumlah baris per tabel:')
    for (const [t, n] of ada) console.log(`  ${t.padEnd(22)} ${n}`)
    if (hilang.length) {
      console.log('')
      console.log(`Tabel belum dibuat: ${hilang.join(', ')}`)
      console.log('  -> Jalankan ulang : bun run db:deploy')
    }
  }

  const users = jumlah.User ?? 0
  const orgs = jumlah.Organization ?? 0
  const icd10 = jumlah.Icd10Code ?? 0

  if (ada.length > 0 && users === 0) {
    console.log('')
    console.log('INFO: Tabel User masih kosong — itu NORMAL untuk database baru.')
    console.log('  `prisma migrate deploy` hanya membuat struktur, bukan isinya.')
    console.log('  Buat praktik + akun Penanggung Jawab pertama (DEPLOYMENT.md Langkah 5):')
    console.log('  DATABASE_URL="..." DIRECT_URL="..." ORG_NAME="..." \\')
    console.log('    ADMIN_EMAIL="..." ADMIN_PASSWORD="..." bun run db:seed:admin')
  }
  if (users > 0 && orgs === 0) {
    console.log('')
    console.log('PERHATIAN: Ada pengguna tanpa praktik — periksa ulang proses bootstrap.')
  }
  if (users > 0 && icd10 === 0) {
    console.log('')
    console.log('INFO: Katalog ICD-10/ICD-9-CM/KFA masih kosong — normal di produksi.')
    console.log('  Impor katalog resmi Kemenkes sebelum pengkodean nyata')
    console.log('  (DEPLOYMENT.md: "Katalog terminologi pada produksi").')
  }

  // — Deteksi data CONTOH (seed demo tidak boleh ada di produksi) —
  try {
    const demo = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM "Organization" WHERE "name" LIKE '%CONTOH%'`,
    )
    if ((demo[0]?.n ?? 0) > 0) {
      console.log('')
      console.log('PERHATIAN: Database ini berisi data CONTOH (fiktif).')
      console.log('  Jangan dipakai untuk praktik sungguhan — gunakan database')
      console.log('  Neon terpisah dan bootstrap lewat db:seed:admin.')
    }
  } catch {
    /* abaikan */
  }

  console.log('')
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    const kode = (e as { code?: string })?.code
    if (kode === 'P1001') {
      console.error('Gagal terhubung ke database (P1001).')
      console.error('Periksa DATABASE_URL (harus host -pooler untuk runtime),')
      console.error('pastikan ?sslmode=require ada, dan region Neon sudah siap.')
    } else {
      console.error('Pemeriksaan gagal:', e instanceof Error ? e.message : e)
    }
    await db.$disconnect()
    process.exit(1)
  })
