# e-SIMANTRI — Sistem Informasi Manajemen Praktik Mandiri Terintegrasi

Aplikasi rekam medis elektronik (RME) untuk **praktik mandiri** di Indonesia
(dokter, dokter gigi, bidan, perawat, apoteker, ahli gizi, fisioterapis).
Bukan SIMRS rumah sakit.

**Status: Fase 0–2 — Fondasi, Registrasi & Kunjungan, Catatan Klinis Dokter Umum** (boleh dicoba; Fase 3 belum dibangun).

## Yang sudah bisa dipakai (Fase 0–2)

- Kerangka aplikasi multi-tenant: satu organisasi = satu tempat praktik
  (satu badan hukum / satu SIP penyelenggara).
- Autentikasi: kata sandi ter-hash (bcrypt), sesi kedaluwarsa otomatis
  (absolut 12 jam, idle 60 menit), verifikasi dua langkah (TOTP) untuk semua
  peran, pencabutan sesi perangkat lain.
- 8 peran bawaan dengan hak yang hanya dapat **dipersempit** per praktik:
  Penanggung Jawab, PPA, PPA Pendamping, Pendaftaran, Rekam Medis,
  Kasir/Klaim, Pasien, Admin Teknis.
- Profil tempat praktik (diubah Penanggung Jawab/Admin Teknis, diaudit).
- Manajemen pengguna & penugasan peran dengan penjaga kewenangan (peran
  klinis menuntut profesi + STR/SIP; hanya PJ boleh menetapkan peran klinis).
- Jejak audit **append-only**: siapa, peran, kapan, aksi, objek, perangkat,
  IP, dan alasan bila akses tidak rutin.
- **Fase 1 — Registrasi & Kunjungan:** pasien per praktik dengan nomor
  rekam medis otomatis (pasien tidak dapat dihapus), NIK tersamarkan pada
  daftar, buka/tutup kunjungan dengan tanggal-jam otomatis.
- **Fase 2 — Catatan klinis dokter umum:** formulir isi minimum PMK
  24/2022, kunci catatan dengan validasi kelengkapan di sisi server,
  kunjungan ikut ditutup saat catatan dikunci, koreksi terkunci hanya lewat
  amandemen beralasan (versi lama dipertahankan dan dapat dibuka), dasbor
  kelengkapan untuk Rekam Medis/Penanggung Jawab, dan audit otomatis atas
  setiap pembukaan catatan oleh pihak bukan penulis.

## Yang sengaja ditunda (agar tidak melompat)

- Kode ICD-10/ICD-9-CM, obat KFA, dan resep terstruktur (Fase 3),
  resume/salinan (Fase 4), adapter SATUSEHAT (Fase 5, sandbox saja),
  portal pasien (Fase 6), templat profesi lain & odontogram (Fase 7),
  klaim/rujukan (Fase 8).

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend + logika server | Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, shadcn/ui |
| Database | PostgreSQL — **Neon** (serverless) via **Prisma** |
| Hosting | **Vercel** (deploy otomatis dari GitHub) |

Skema database (`prisma/schema.prisma`) memakai provider `postgresql` dengan
pemisahan `DATABASE_URL` (pooled, untuk runtime) dan `DIRECT_URL` (direct,
untuk migrasi) — sesuai anjuran arsitektur Neon.

## Mulai cepat (lokal)

```bash
bun install
cp .env.example .env       # isi DATABASE_URL + DIRECT_URL (Neon atau Postgres lokal)
bun run db:deploy          # terapkan migrasi skema
bun run db:seed            # DATA CONTOH fiktif — hanya untuk demo/latihan!
bun run dev                # http://localhost:3000
```

Akun contoh (hanya dari seed CONTOH, kata sandi semua akun `Contoh123!`):
`andi@praktik-contoh.id` (Penanggung Jawab + PPA, lintas praktik —
penulis catatan contoh), `sari@praktik-contoh.id` (PPA Pendamping),
`rina@praktik-contoh.id` (Pendaftaran), `tono@praktik-contoh.id`
(Rekam Medis), `budi@praktik-contoh.id` (Kasir), `admin@praktik-contoh.id`
(Admin Teknis), `dewi@praktik-contoh.id` (PJ praktik bidan).

Uji verifikasi otomatis: `bun tests/verify-phase0.ts` dan
`bun tests/verify-fase12.ts` (database harus berisi seed CONTOH).

## Deploy produksi

Panduan lengkap langkah demi langkah — **Neon → GitHub → Vercel** beserta
bootstrap akun produksi, verifikasi pasca-deploy, kepatuhan retensi, dan
troubleshooting: lihat **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Disiplin pengembangan

- Pengembangan per fase; fase berikutnya hanya dimulai setelah fase aktif
  benar-benar bisa dicoba.
- Larangan keras: menghapus isi klinis, berbagi akun, satu "admin" yang
  melihat semua praktik, integrasi SATUSEHAT produksi sebelum fase-nya.
- Seluruh data contoh diberi penanda **CONTOH** dan dinyatakan fiktif.
