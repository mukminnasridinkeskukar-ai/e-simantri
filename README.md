# e-SIMANTRI — Sistem Informasi Manajemen Praktik Mandiri Terintegrasi

RME (rekam medis elektronik) untuk **praktik mandiri** — dokter, dokter gigi, perawat,
bidan, apoteker, gizi, fisioterapi, psikologi — bukan SIMRS rumah sakit.

- Antarmuka **Bahasa Indonesia**, nada tenang-jelas-klinis.
- **Multi-tenant**: satu platform, banyak praktik; data terisolasi per praktik.
- **Multi-peran**: 8 peran bawaan; satu akun boleh tergabung di banyak praktik dengan peran berbeda.
- **Kepatuhan dengan jujur**: mengikuti PMK 24/2022 (RME), UU 17/2023, UU 27/2022 (PDP),
  PP 71/2019 (PSE), pedoman interoperabilitas SATUSEHAT (FHIR R4). Tanpa klaim sertifikasi.

## Status: Fase 0–8 diluncurkan (lingkungan contoh)

| Fase | Modul | Status |
| ---- | ----- | ------ |
| 0 | Fondasi: tenant, masuk akun, peran, audit, profil praktik | ✅ |
| 1 | Registrasi pasien (anti-duplikat, nomor RM otomatis) & kunjungan (4 jenis, alur status) | ✅ |
| 2 | Catatan klinis berversi per profesi, kunci kunjungan + cek field wajib, tanpa hapus | ✅ |
| 3 | Diagnosa ICD-10 (wajib berkode), tindakan ICD-9-CM, resep KFA, terminologi kustom | ✅ |
| 4 | Resume otomatis + salinan cetak (resume, resep, rujukan) dengan jejak cetak | ✅ |
| 5 | Adapter SATUSEHAT pola outbox + mapper FHIR R4 + pekerja SIMULASI/SANDBOX | ✅ |
| 6 | Portal pasien (kode 6 digit + tanggal lahir) & persetujuan (snapshot teks) | ✅ |
| 7 | Mutu kelengkapan, retensi 25 tahun, odontogram 32 gigi, templat per profesi | ✅ |
| 8 | Tagihan ringan + ekspor CSV, surat rujukan bernomor otomatis | ✅ |

## Menjalankan (demo)

```bash
bun install
bun run db:push
bun prisma/seed.ts            # akun & praktik contoh
bun prisma/seed-fase-1-8.ts   # data klinis contoh + terminologi
bun run dev                   # http://localhost:3000
```

Akun contoh (sandi semua: `Contoh#2026`):

| Surel | Peran |
| ----- | ----- |
| andi@contoh.id | Penanggung Jawab + PPA |
| budi@contoh.id | PPA (dokter gigi) |
| ayu@contoh.id | PPA Pendamping |
| ani@contoh.id | Pendaftaran |
| rani@contoh.id | Rekam Medis |
| sari@contoh.id | Kasir |
| tono@contoh.id | Admin Teknis |
| siti@contoh.id | Pasien (via portal) |

Portal pasien: `/portal` — kode demo `482913` + tanggal lahir `10/01/1988`.

## Jaminan kepatuhan yang ditegaskan kode

1. **Tidak ada jalur hapus** untuk isi rekam medis: koreksi = versi baru; status batal
   hanya dengan alasan dan tetap teraudit.
2. **Kunci kunjungan** menolak bila field wajib rawat jalan belum lengkap; membuka kunci
   hanya Penanggung Jawab + alasan + audit.
3. **Isolasi tenant**: semua kueri terlingkup `organizationId` dari sesi server.
4. **Audit append-only**: tidak ada fungsi ubah/hapus di lapisan aplikasi.
5. **SATUSEHAT**: inti RME tidak memanggil API dari layar; hanya lewat outbox + worker;
   kondisi tanpa kode ditolak mapper; mode SIMULASI tidak mengirim apa pun.
6. **Portal pasien**: kode akses disimpan sebagai hash; hanya kunjungan terkunci yang tampil.

## Deploy

Lihat [DEPLOY.md](./DEPLOY.md) — GitHub → Vercel → Supabase (PostgreSQL), termasuk
variabel lingkungan, migrasi skema, cron pekerja antrean, dan checklist keamanan produksi.
