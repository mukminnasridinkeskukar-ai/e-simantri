# Panduan Deployment e-SIMANTRI — GitHub + Vercel + Neon

Panduan ini menjelaskan cara membawa aplikasi e-SIMANTRI (Fase 0 — Fondasi)
dari repositori lokal ke internet dengan susunan:

```
[ Laptop Anda ] --git push--> [ GitHub ] --import--> [ Vercel (frontend+API) ]
                                                           |
                                                    DATABASE_URL (pooled)
                                                           v
                                                    [ Neon PostgreSQL ]
                                                           ^
                                                    DIRECT_URL (direct)
                                                   untuk migrasi skema
```

| Komponen | Layanan | Peran |
|---|---|---|
| Frontend + Server Actions | **Vercel** | Menjalankan Next.js 16 (UI + logika server) |
| Database | **Neon** | PostgreSQL serverless (data praktik, akun, audit) |
| Sumber kode | **GitHub** | Repositori; setiap push ke branch utama memicu deploy ulang otomatis |

> Seluruh perintah pada panduan ini dijalankan di terminal pada folder proyek.

---

## Prasyarat

1. Akun GitHub aktif — https://github.com/signup
2. Akun Vercel aktif (disarankan: masuk **menggunakan akun GitHub** agar
   repositori langsung terhubung) — https://vercel.com/signup
3. Akun Neon aktif — https://neon.tech/signup (masuk dengan akun GitHub juga boleh)
4. Salah satu dari berikut di komputer lokal: `git` (wajib), `node` ≥ 20.9 atau `bun` (opsional, untuk menjalankan/migrasi dari lokal)

---

## Langkah 1 — Buat Database di Neon

1. Masuk ke **Neon Console** (https://console.neon.tech).
2. Klik **Create project** (atau "New Project").
3. Isi:
   - **Project name**: `esimantri` (atau nama praktik Anda)
   - **PostgreSQL version**: 16 atau 17 (biarkan bawaan)
   - **Cloud region / Cloud & region**: pilih **AWS / Singapore (ap-southeast-1)** —
     paling dekat dengan Indonesia agar latensi rendah.
4. Setelah proyek jadi, Neon menampilkan **Connection string**.
5. Di panel koneksi, pastikan tombol **"Pooled connection"** / "Connection pooling"
   **AKTIF**, lalu salin string tersebut. Ini akan menjadi `DATABASE_URL`.
6. Matikan (nonaktifkan) opsi pooled, lalu salin lagi string itu. Ini menjadi
   `DIRECT_URL`.

Ciri pembeda kedua string tersebut — perhatikan nama host-nya:

```
DATABASE_URL (pooled) : postgresql://USER:PASSWORD@ep-nama-xxxx-pooler.ap-southeast-1.aws.neon.tech/esimantri?sslmode=require
DIRECT_URL (direct)   : postgresql://USER:PASSWORD@ep-nama-xxxx.ap-southeast-1.aws.neon.tech/esimantri?sslmode=require
```

String pooled selalu mengandung `-pooler` pada nama host. **Simpan keduanya
secara aman** (jangan dibagikan, jangan dikommit ke Git).

> Koneksi *pooled* dipakai aplikasi saat berjalan (cocok untuk serverless Vercel).
> Koneksi *direct* dipakai `prisma migrate deploy` saat mengubah skema.

---

## Langkah 2 — Siapkan Proyek di Komputer Lokal

Dari folder proyek e-SIMANTRI:

```bash
# 1. Pasang dependensi
bun install          # atau: npm install

# 2. Salin contoh environment, lalu isi dengan string Neon Anda
cp .env.example .env
```

Edit `.env` dan isi kedua nilai dari Langkah 1:

```env
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/esimantri?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/esimantri?sslmode=require"
```

Terapkan skema database ke Neon:

```bash
bun run db:deploy    # menjalankan: prisma migrate deploy
```

Keluaran yang benar berakhir dengan `1 migration(s) ... applied`. Database di
Neon kini sudah berisi tabel Fase 0: `Organization`, `User`, `Membership`,
`Session`, `AuditLog`.

> **Jangan jalankan `bun run db:seed` terhadap Neon.** Perintah itu mengisi
> **data contoh fiktif (CONTOH)** yang hanya untuk demo/latihan. Untuk
> praktik sungguhan, buat akun produksi lewat Langkah 5.

---

## Langkah 3 — Unggah ke GitHub

```bash
# inisialisasi repositori (jika belum)
git init
git add .
git commit -m "e-SIMANTRI Fase 0 — fondasi (Next.js 16 + Prisma + PostgreSQL/Neon)"

# buat repositori baru bernama esimantri di github.com/new (tanpa README bawaan),
# lalu hubungkan dan unggah:
git branch -M main
git remote add origin https://github.com/USERNAME/esimantri.git
git push -u origin main
```

Catatan penting:

- File `.env` **sudah dikecualikan** oleh `.gitignore` (pola `.env*`) — kredensial
  database tidak akan ikut terunggah. Verifikasi dengan `git status` sebelum push.
- Folder `/.pgsql/`, `/db/`, dan log juga dikecualikan.

---

## Langkah 4 — Deploy ke Vercel

1. Buka https://vercel.com/new (masuk dengan akun GitHub Anda).
2. Pada daftar repositori, klik **Import** pada repositori `esimantri`.
   (Jika tidak muncul, klik **Adjust GitHub App Permissions** lalu beri Vercel
   akses ke repositori tersebut.)
3. Di bagian **Configure Project**, biarkan:
   - **Framework Preset**: Next.js (terdeteksi otomatis)
   - **Build Command**: biarkan bawaan — Vercel memakai skrip `vercel-build`
     dari `package.json`, yaitu `prisma migrate deploy && next build`.
   - **Install Command**: biarkan bawaan (skrip `postinstall` menjalankan
     `prisma generate`).
4. Buka bagian **Environment Variables** dan tambahkan **4 variabel** berikut
   (isi nilainya dari Langkah 1). Tambahkan untuk scope **Production** dan
   **Preview**:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | string **pooled** Neon (host ber `-pooler`) |
   | `DIRECT_URL` | string **direct** Neon (host tanpa `-pooler`) |

5. Klik **Deploy** dan tunggu 1–3 menit.
6. Bila berhasil, Vercel menampilkan alamat aplikasi, mis.
   `https://esimantri-USERNAME.vercel.app`. Buka alamat itu — halaman
   **Masuk e-SIMANTRI** harus tampil.

> Setiap `git push` ke branch `main` selanjutnya otomatis memicu deploy ulang
> (continuous deployment) — tidak perlu mengulang langkah di atas.

---

## Langkah 5 — Buat Akun Produksi Pertama (Bootstrap)

Aplikasi produksi dimulai **kosong** dan tidak menyediakan pendaftaran mandiri
(sesuai disiplin Fase 0). Buat praktik + akun Penanggung Jawab pertama dari
komputer lokal, menunjuk langsung ke Neon:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/esimantri?sslmode=require" \
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/esimantri?sslmode=require" \
ORG_NAME="Praktik Dokter Nama Anda" \
ORG_PRACTICE_TYPE="PRAKTIK_DOKTER" \
ORG_SIP_NUMBER="445/1/XXXX/2026" \
ORG_ADDRESS="Jl. Alamat Praktik No. 1" \
ORG_CITY="Kota Anda" \
ORG_PROVINCE="Provinsi Anda" \
ORG_PHONE="0812xxxxxxx" \
ADMIN_EMAIL="pj@praktikanda.id" \
ADMIN_FULL_NAME="dr. Nama Anda" \
ADMIN_PASSWORD="KataSandiKuat123" \
bun run db:seed:admin
```

Keterangan:

- `ORG_PRACTICE_TYPE` salah satu dari: `PRAKTIK_DOKTER`, `PRAKTIK_DOKTER_GIGI`,
  `PRAKTIK_BIDAN`, `PRAKTIK_PERAWAT`, `PRAKTIK_APOTEKER`, `PRAKTIK_AHLI_GIZI`,
  `PRAKTIK_FISIOTERAPI`, `PRAKTIK_LAINNYA`.
- `ADMIN_PASSWORD` minimal 8 karakter, memuat huruf dan angka.
- Skrip menolak berjalan bila email admin sudah terdaftar (aman diulang bila
  gagal sebelum sempat membuat akun).

Setelah berhasil:

1. Buka alamat Vercel Anda, masuk dengan `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
2. Sistem menandai akun ini **wajib mengganti kata sandi** — segera ganti.
3. Buka menu **Akun & Keamanan → Verifikasi dua langkah** dan **aktifkan 2FA**
   (TOTP lewat aplikasi authenticator, mis. Google Authenticator). Peran
   Penanggung Jawab wajib mengaktifkan 2FA sebelum digunakan sehari-hari.
4. Gunakan menu **Pengguna** untuk menambah akun staf lain (pendaftaran,
   rekam medis, kasir, dst.) dengan peran yang paling sempit sesuai tugasnya.

---

## Langkah 6 — Verifikasi Pasca-Deploy (5 menit)

Centang satu per satu pada alamat Vercel Anda:

| # | Uji | Hasil yang benar |
|---|---|---|
| 1 | Buka alamat Vercel | Halaman Masuk tampil, ada panel "Akun contoh (data fiktif)" **hanya bila** database berisi seed contoh; database produksi baru tampil bersih |
| 2 | Masuk dengan email salah | Pesan "Email atau kata sandi salah." tanpa membocorkan mana yang salah |
| 3 | Masuk dengan akun admin | Muncul pemilih praktik (bila satu praktik langsung masuk Beranda) |
| 4 | Buka **Jejak Audit** | Terlihat: Inisialisasi, Masuk berhasil, Pilih praktik aktif — lengkap dengan waktu, peran, dan IP |
| 5 | Buka **Profil Praktik** | Data praktik sesuai isian bootstrap Langkah 5 |
| 6 | Tambah akun staf di **Pengguna** | Akun baru muncul pada daftar; tercatat di Jejak Audit |
| 7 | Daftarkan pasien, buka kunjungan, tulis & kunci catatan (peran PPA) | No. RM otomatis; penguncian menolak bila bagian wajib PMK belum lengkap; setelah lengkap → catatan terkunci, kunjungan selesai |
| 8 | Pada catatan draf, cari dan pilih kode ICD-10 di kartu **Kodifikasi**, tambah resep dari katalog KFA, lalu kunci catatan | Kode & resep ikut beku saat catatan terkunci; resep salah hanya dapat **Dibatalkan** dengan alasan (tidak ada hapus) |
| 9 | Buka menu **Terminologi** (peran PPA/PPA Pendamping/Rekam Medis) | Ketiga katalog tampil; pencarian katalog tidak menulis jejak akses klinis |
| 10 | Buka **Kelengkapan** (peran Penanggung Jawab / Rekam Medis) | Statistik kunjungan/catatan tampil tanpa membuka isi klinis |
| 11 | Tinggalkan sesi > 60 menit lalu klik apa pun | Sesi berakhir otomatis (diminta masuk kembali) |

Bila semua tercentang, **Fase 0-3 berjalan di produksi** dan siap dicoba tim Anda.

### Katalog terminologi pada produksi (WAJIB sebelum pengkodean nyata)

Seed produksi (Langkah 5) TIDAK mengisi katalog ICD-10/ICD-9-CM/KFA —
subset berlabel CONTOH sengaja tidak boleh masuk lingkungan produksi.
Sebelum praktik memakai pengkodean sungguhan, impor katalog resmi
Kemenkes ke tabel `Icd10Code`, `Icd9CmCode`, dan `KfaCode` (mis. lewat
skrip `prisma db execute --file katalog.sql` atau skrip impor khusus).
Sampai katalog diimpor, kartu Kodifikasi/Resep hanya dapat dipakai pada
lingkungan demo ber-CONTOH.

---

## Alur Kerja Harian Setelah Terpasang

```bash
# mengubah kode → commit → push → deploy otomatis
git add .
git commit -m "deskripsi perubahan"
git push            # Vercel membangun & menerbitkan otomatis

# mengubah skema database (fase berikutnya)
# 1. buat/mesin migrasi di lokal:
bun run db:migrate            # prisma migrate dev → berkas SQL baru di prisma/migrations/
# 2. commit folder prisma/migrations, push.
# 3. saat Vercel membangun, `prisma migrate deploy` menerapkan migrasi ke Neon.
```

Aturan yang dijaga mulai Fase 0 (berlaku juga untuk fase berikutnya):

- **Tidak ada penghapusan isi klinis** — dan tabel `AuditLog` bersifat
  append-only (tidak tersedia fungsi ubah/hapus di lapisan aplikasi).
- Semua akses database selalu terlingkup **organisasi aktif dari sesi server**;
  `organization_id` dari browser tidak pernah dipercaya.
- Kata sandi tersimpan sebagai hash bcrypt; token sesi hanya tersimpan sebagai
  hash SHA-256; sesi punya batas absolut 12 jam dan lembur (idle) 60 menit.

---

## Keamanan & Kepatuhan untuk Produksi

1. **Lindungi kredensial.** `DATABASE_URL`/`DIRECT_URL` hanya ada di Vercel
   (Environment Variables) dan `.env` lokal yang tidak dikommit. Bila tidak
   sengaja bocor: ganti kata sandi pengguna database di Neon (Roles → Reset
   password), lalu perbarui variabel di Vercel dan deploy ulang.
2. **Aktifkan 2FA untuk semua akun peran klinis dan Penanggung Jawab** —
   tersedia di menu Akun & Keamanan sejak Fase 0.
3. **Retensi & cadangan (PMK 24/2022: isi rekam medis disimpan sekurang-kurangnya
   25 tahun sejak kunjungan terakhir).** Mulai sekarang jadwalkan ekspor
   berkala, mis. `pg_dump` bulanan yang disimpan di tempat aman:

   ```bash
   pg_dump "postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/esimantri?sslmode=require" \
     --format=custom --file=esimantri-backup-$(date +%Y%m%d).dump
   ```

   Neon juga menyediakan riwayat restore (point-in-time restore) pada paket
   berbayar; konfigurasikan sesi kebutuhan praktik Anda.
4. **Data contoh (CONTOH) tidak boleh ada di database produksi.** Bila tidak
   sengaja ter-seed, jangan hapus manual lewat aplikasi; hubungi pengelola
   untuk pembersihan terarah melalui skrip.
5. **Jangan bagikan satu akun untuk banyak orang** — setiap pengguna wajib
   punya akun sendiri agar jejak audit bermakna hukum.
6. Pesan kesalahan teknis (log) tidak menampilkan isi data klinis; log koneksi
   dari Neon/Vercel berada di bawah kendali penyedia masing-masing.

---

## Troubleshooting

| Gejala | Penyebab umum | Penanganan |
|---|---|---|
| `P1001: Can't reach database server` saat deploy/lokal | String koneksi salah salin; region belum siap; `sslmode=require` hilang | Salin ulang dari Neon Console; pastikan `?sslmode=require` tetap ada; tunggu 1–2 menit setelah proyek dibuat |
| `P1001` hanya di Vercel, tapi lokal jalan | Memakai string *direct* (tanpa `-pooler`) sebagai `DATABASE_URL` di serverless | Pastikan `DATABASE_URL` memakai host **`-pooler`** |
| `P2024: Timed out fetching a new connection from the connection pool` | Lonjakan koneksi serverless | Pastikan memakai endpoint pooled; batasi jumlah instance; cek panel Neon untuk beban |
| `Error: Authentication failed` saat `migrate deploy` | `DIRECT_URL` kosong/mengandung `-pooler` (beberapa operasi migrasi lebih stabil di koneksi direct) | Set `DIRECT_URL` ke host tanpa `-pooler` |
| Vercel build gagal `prisma: not found` | Dependensi tidak terpasang bersih | Jalankan ulang deploy; pastikan tidak menghapus `prisma` dari `package.json` |
| Halaman memuat tapi login gagal terus | Database masih kosong (belum bootstrap) | Jalankan Langkah 5 (`db:seed:admin`) |
| Data CONTOH ikut terbawa ke produksi | Menjalankan `db:seed` pada Neon | Jangan ulangi; beri tanda praktik contoh NONAKTIF lewat pengelolaan akun, jangan hapus isi audit |
| Jam/latensi terasa lambat dari Indonesia | Region Neon bukan Singapore | Buat proyek baru di `ap-southeast-1`, migrasikan data dengan dump/restore |

---

## Ringkasan Variabel Lingkungan

| Variabel | Dipakai di | Isi |
|---|---|---|
| `DATABASE_URL` | Vercel (Production + Preview), `.env` lokal | Connection string **pooled** Neon |
| `DIRECT_URL` | Vercel (Production + Preview), `.env` lokal | Connection string **direct** Neon |

Tidak ada variabel rahasia lain pada Fase 0 — token sesi dibuat acak per
login dan hanya hash-nya disimpan di database.
