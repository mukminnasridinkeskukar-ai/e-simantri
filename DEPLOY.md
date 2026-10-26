# Panduan Deploy e-SIMANTRI — GitHub + Vercel + Supabase

Panduan ini membawa lingkungan contoh (sandbox) ke penerapan nyata milik Anda.
**Penting:** aplikasi ini adalah kerangka RME dengan data CONTOH. Sebelum memuat data
pasien sungguhan, penyelenggara bertanggung jawab atas peninjauan hukum, uji keamanan,
registrasi PSE (bila lingkupnya memenuhi ketentuan), dan kebijakan retensi/cadangan
mengikuti peraturan yang berlaku.

## Arsitektur

```
GitHub (repo)  →  Vercel (frontend + API Next.js)  →  Supabase (Postgres + auth DB)
```

- Frontend & API: Next.js 16 App Router (server actions + server components).
- Basis data: PostgreSQL Supabase melalui Prisma ORM.
- Sesi: kuki httpOnly (token acak; basis data menyimpan SHA-256) — tanpa dependensi pihak ketiga.
- Jejak audit: tabel append-only; tidak ada jalur ubah/hapus di lapisan aplikasi.

## 1. Supabase (basis data)

1. Buat proyek baru di https://supabase.com → catat **database password**.
2. Buka *Project Settings → Database → Connection string*:
   - **Pooled connection (untuk Vercel/serverless):** `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true`
   - **Direct connection (untuk migrasi):** `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
3. (Disarankan) Aktifkan *Row Level Security* di tabel Supabase sebagai lapisan kedua.
   Aplikasi sudah mengisolasi tenant lewat `organizationId` dari sesi server, tetapi
   pertahanan berlapis baik untuk data kesehatan.

## 2. GitHub

Ekstrak paket ZIP yang diterima, masuk ke folder hasil ekstraksi, lalu:

```bash
git init
git add .
git commit -m "e-SIMANTRI: RME praktik mandiri (Fase 0-8, lingkungan contoh)"
git branch -M main
git remote add origin https://github.com/<akun>/<repo>.git
git push -u origin main
```

Sertakan `.env.example` (lihat di bawah) dan **jangan pernah** commit `.env` berisi kredensial.

## 3. Skema untuk PostgreSQL

Paket ini sudah menyertakan **varian PostgreSQL siap pakai**:
`prisma/schema.postgres.prisma` — dibuat otomatis dari `prisma/schema.prisma`
lewat `node scripts/buat-skema-postgres.mjs`, sehingga model kedua varian
selalu sinkron.

Pastikan `.env` berisi kredensial Supabase (salin dari `.env.example`):

```env
DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true"   # pooled
DIRECT_URL="postgresql://...:5432/postgres"                    # direct (migrasi)
```

Lalu terapkan skema:

```bash
npx prisma generate --schema prisma/schema.postgres.prisma
npx prisma db push --schema prisma/schema.postgres.prisma
# atau: npx prisma migrate dev --schema prisma/schema.postgres.prisma --name init
```

`vercel.json` pada repo ini sudah mengatur build command sehingga Prisma Client
di Vercel dibuat dari varian PostgreSQL — tanpa penyuntingan manual.

> Catatan: skema sengaja tidak memakai enum Prisma (kompatibel SQLite→Postgres) dan
> seluruh nilai terbatasi di lapisan aplikasi.

## 4. Seed (opsional — data contoh)

Jalankan sekali terhadap Supabase agar aplikasi punya data CONTOH untuk dicoba
(pastikan `.env` sudah menunjuk ke Supabase seperti pada langkah 3):

```bash
bun prisma/seed.ts
bun prisma/seed-fase-1-8.ts
```

Untuk operasi nyata: **jangan** seed; buat praktik dan pengguna pertama melalui UI
(akun pertama perlu dibuat via seed minimal atau skrip kecil, lalu ganti sandinya).

## 5. Vercel

1. https://vercel.com/new → impor repo GitHub Anda.
2. Framework Preset: **Next.js** (deteksi otomatis). Jangan ubah build command.
3. Environment Variables (Production + Preview):

| Variabel                | Nilai                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`          | URL **pooled** Supabase (port 6543, `?pgbouncer=true`)        |
| `DIRECT_URL`            | URL **direct** Supabase (port 5432) — untuk migrasi           |
| `PORTAL_SESSION_SECRET` | string acak ≥ 32 karakter (`openssl rand -hex 32`)            |
| `CRON_SECRET`           | (opsional) rahasia endpoint cron pekerja antrean SATUSEHAT   |
| `NODE_ENV`              | `production`                                                  |

4. Deploy. `vercel.json` pada repo sudah mengatur build command
   (`prisma generate --schema prisma/schema.postgres.prisma && next build`),
   sehingga Prisma Client untuk PostgreSQL dibuat otomatis pada setiap build —
   tidak perlu menambah `postinstall`.

5. (Opsional) Custom domain di *Settings → Domains*. HTTPS otomatis.

### Prisma di serverless

- Selalu pakai **pooled URL** pada `DATABASE_URL` di Vercel (batas koneksi).
- Versi produksi disarankan menambah `+prisma` serverless driver atau Neon/Supabase
  pooler sesuai dokumentasi terbaru keduanya.

## 6. `.env.example`

Berkas `.env.example` sudah disertakan pada paket ini — salin menjadi `.env`
lalu isi nilainya (SQLite untuk demo lokal; PostgreSQL Supabase untuk produksi).
Jangan pernah commit `.env` sungguhan.

## 7. Integrasi SATUSEHAT (sandbox)

1. Masuk sebagai Admin Teknis/PJ → menu **SATUSEHAT**.
2. Mode `SANDBOX` + isi URL sandbox, Client ID, Client Secret dari kredensial sandbox Anda.
3. Aktifkan antrean → kunci satu kunjungan lengkap → tekan **Proses antrean**.
4. Status per kejadian + riwayat percobaan terlihat di halaman yang sama; kegagalan bisa
   dicoba ulang dan tidak pernah menghapus data lokal.
5. Untuk produksi: pindahkan `clientSecret` ke environment variable / secret manager dan
   jadikan pekerja antrean cron (mis. Vercel Cron memanggil endpoint pekerja) — jangan
   mengandalkan tombol manual.

## 8. Keamanan & tata kelola produksi (checklist penyelenggara)

- [ ] Ganti seluruh sandi akun contoh / hapus akun contoh (`Contoh#2026` adalah sandi demo).
- [ ] `PORTAL_SESSION_SECRET` unik per lingkungan.
- [ ] Cadangan basis data terjadwal (Supabase Point-in-Time Recovery) — isi rekam medis
      tidak boleh hilang dan rentang simpannya panjang (peraturan mensyaratkan 25 tahun).
- [ ] Terapkan prinsip hak akses minimum saat mengundang pengguna; peran klinis disarankan
      mengaktifkan 2FA pada penyedia identitas bila tersedia.
- [ ] Uji isolasi tenant sebelum go-live (akun praktik A tidak boleh melihat praktik B).
- [ ] Catat rujukan regulasi di menu Mutu & Retensi dan tinjau ulang berkala.
- [ ] Pendaftaran PSE & penilaian hukum oleh penyelenggara (bukan klaim aplikasi).

## 9. Pekerja antrean SATUSEHAT (cron)

Tombol "Proses antrean" menjalankan pekerja secara manual. Di produksi, jadwalkan
endpoint yang **sudah tersedia di repo ini**: `GET /api/antrean/proses`. Endpoint
ini menolak berjalan bila `CRON_SECRET` belum diatur, dan memverifikasi header
`Authorization: Bearer <CRON_SECRET>` (dikirim otomatis oleh Vercel Cron) dengan
perbandingan `timingSafeEqual`.

Aktifkan jadwal dengan menambahkan blok berikut pada `vercel.json`:

```json
{
  "crons": [{ "path": "/api/antrean/proses", "schedule": "*/5 * * * *" }]
}
```

> Jadwal `*/5` memerlukan paket Vercel berbayar; pada paket Hobby gunakan jadwal
> harian atau andalkan tombol manual. Mode SIMULASI tidak menghasilkan trafik
> keluar, sehingga aman diuji kapan pun.
