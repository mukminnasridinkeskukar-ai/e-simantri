// ============================================================
// Membuat prisma/schema.postgres.prisma dari prisma/schema.prisma
// sehingga model kedua varian SELALU sinkron; hanya blok datasource
// yang berbeda (provider postgresql + directUrl untuk migrasi).
//
// Pemakaian:  node scripts/buat-skema-postgres.mjs
// Aturan: jangan sunting schema.postgres.prisma secara manual — ubah
// schema.prisma lalu jalankan ulang skrip ini.
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const jalurSumber = join(root, 'prisma/schema.prisma')
const jalurHasil = join(root, 'prisma/schema.postgres.prisma')

const sumber = readFileSync(jalurSumber, 'utf8')

const pola = /datasource db \{[^}]*\}/
if (!pola.test(sumber)) {
  console.error('GALAT: blok datasource tidak ditemukan pada prisma/schema.prisma')
  process.exit(1)
}

const blokBaru = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL") // koneksi pooled (serverless/Vercel)
  directUrl = env("DIRECT_URL") // koneksi langsung (prisma db push / migrate)
}`

const kepala = `// ============================================================
// VARIAN POSTGRESQL (Supabase) — dibuat OTOMATIS dari prisma/schema.prisma
// oleh scripts/buat-skema-postgres.mjs. JANGAN sunting berkas ini manual;
// ubah schema.prisma lalu jalankan ulang skripnya.
// ============================================================

`

const hasil = kepala + sumber.replace(pola, blokBaru)
writeFileSync(jalurHasil, hasil)
console.log('OK: prisma/schema.postgres.prisma dibuat ulang dari prisma/schema.prisma')
