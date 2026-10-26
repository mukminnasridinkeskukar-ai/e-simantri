// ============================================================
// SEED e-SIMANTRI — Fase 0
// Data contoh FIKTIF untuk lingkungan demo. Semua nama, nomor STR/SIP,
// alamat, dan kontak adalah karangan dan ditandai CONTOH.
// Jangan pernah memuat data pasien sungguhan di lingkungan demo.
// Jalankan: bun prisma/seed.ts
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const KATA_SANDI_DEMO = 'Contoh#2026'

async function main() {
  console.log('Memulai seed Fase 0 e-SIMANTRI (data CONTOH)…')

  const sandiHash = bcrypt.hashSync(KATA_SANDI_DEMO, 12)

  // ---------- Organisasi contoh ----------
  const org = await db.organization.upsert({
    where: { id: 'org-contoh-sehat-sentosa' },
    update: {},
    create: {
      id: 'org-contoh-sehat-sentosa',
      name: 'Praktik Dokter Umum Sehat Sentosa (CONTOH)',
      practiceType: 'DOKTER_UMUM',
      sipNumber: 'SIP-CONTOH-2026-001',
      address: 'Jl. Melati No. 10, Kel. Contoh, Kec. Contoh, Kota Contoh (ALAMAT CONTOH)',
      phone: '0812-1111-2222 (CONTOH)',
      email: 'praktik@contoh.id',
      headName: 'dr. Andi Wijaya (CONTOH)',
      isSample: true,
      status: 'AKTIF',
    },
  })

  // ---------- Lokasi contoh ----------
  await db.location.upsert({
    where: { id: 'loc-contoh-utama' },
    update: {},
    create: {
      id: 'loc-contoh-utama',
      organizationId: org.id,
      name: 'Ruang Pemeriksaan Utama (CONTOH)',
      description: 'Lokasi pemeriksaan utama tempat praktik.',
      isPrimary: true,
    },
  })
  await db.location.upsert({
    where: { id: 'loc-contoh-tindakan' },
    update: {},
    create: {
      id: 'loc-contoh-tindakan',
      organizationId: org.id,
      name: 'Ruang Tindakan (CONTOH)',
      description: 'Lokasi tindakan kecil.',
      isPrimary: false,
    },
  })

  // ---------- Pengguna contoh ----------
  const pengguna = [
    {
      email: 'andi@contoh.id',
      fullName: 'dr. Andi Wijaya (CONTOH)',
      profession: 'Dokter',
      strNumber: 'STR-CONTOH-001234',
      sipNumber: 'SIP-CONTOH-DR-001',
      phone: '0812-3333-4444 (CONTOH)',
      peran: ['PENANGGUNG_JAWAB', 'PPA'],
    },
    {
      email: 'budi@contoh.id',
      fullName: 'drg. Budi Santoso (CONTOH)',
      profession: 'Dokter Gigi',
      strNumber: 'STR-CONTOH-004321',
      sipNumber: 'SIP-CONTOH-DRG-002',
      phone: null,
      peran: ['PPA'],
    },
    {
      email: 'ayu@contoh.id',
      fullName: 'Ni Made Ayu Lestari (CONTOH)',
      profession: 'Perawat',
      strNumber: 'STR-CONTOH-007789',
      sipNumber: 'SIP-CONTOH-NRS-003',
      phone: null,
      peran: ['PPA_PENDAMPING'],
    },
    {
      email: 'ani@contoh.id',
      fullName: 'Ani Puspita (CONTOH)',
      profession: 'Staf Administrasi',
      strNumber: null,
      sipNumber: null,
      phone: null,
      peran: ['PENDAFTARAN'],
    },
    {
      email: 'rani@contoh.id',
      fullName: 'Rani Kusuma (CONTOH)',
      profession: 'Staf Administrasi',
      strNumber: null,
      sipNumber: null,
      phone: null,
      peran: ['REKAM_MEDIS'],
    },
    {
      email: 'sari@contoh.id',
      fullName: 'Sari Dewi (CONTOH)',
      profession: 'Staf Administrasi',
      strNumber: null,
      sipNumber: null,
      phone: null,
      peran: ['KASIR'],
    },
    {
      email: 'tono@contoh.id',
      fullName: 'Tono Prakoso (CONTOH)',
      profession: 'Staf Administrasi',
      strNumber: null,
      sipNumber: null,
      phone: null,
      peran: ['ADMIN_TEKNIS'],
    },
    {
      email: 'siti@contoh.id',
      fullName: 'Siti Aminah (CONTOH)',
      profession: null,
      strNumber: null,
      sipNumber: null,
      phone: null,
      peran: ['PASIEN'],
    },
  ]

  for (const p of pengguna) {
    const user = await db.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        email: p.email,
        passwordHash: sandiHash,
        fullName: p.fullName,
        profession: p.profession,
        strNumber: p.strNumber,
        sipNumber: p.sipNumber,
        phone: p.phone,
        isActive: true,
      },
    })

    const membership = await db.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: {},
      create: {
        userId: user.id,
        organizationId: org.id,
        status: 'AKTIF',
      },
    })

    for (const role of p.peran) {
      await db.membershipRole.upsert({
        where: { membershipId_role: { membershipId: membership.id, role } },
        update: {},
        create: { membershipId: membership.id, role },
      })
    }
  }

  // ---------- Regulasi acuan ----------
  const regulasi = [
    {
      code: 'PMK-24-2022',
      title: 'Peraturan Menteri Kesehatan Nomor 24 Tahun 2022 tentang Rekam Medis',
      status: 'BERLAKU',
      note: 'Acuan utama penyelenggaraan RME tempat praktik mandiri. Mencabut Permenkes 269/MENKES/PER/III/2008. Naskah resmi: JDIH Kemenkes.',
      lastReviewedAt: new Date('2026-10-01'),
    },
    {
      code: 'UU-17-2023',
      title: 'Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan',
      status: 'BERLAKU',
      note: 'Payung hukum penyelenggaraan pelayanan kesehatan. Naskah resmi: JDIH Kemenkes.',
      lastReviewedAt: new Date('2026-10-01'),
    },
    {
      code: 'UU-27-2022',
      title: 'Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi',
      status: 'BERLAKU',
      note: 'Data kesehatan adalah data pribadi yang bersifat spesifik; hak akses, salinan, perbaikan, dan pembatasan diwujudkan sebagai fitur.',
      lastReviewedAt: new Date('2026-10-01'),
    },
    {
      code: 'PP-71-2019',
      title: 'Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik',
      status: 'BERLAKU',
      note: 'Termasuk ketentuan pendaftaran PSE bila sistem dipakai secara luas. Naskah resmi: JDIH.',
      lastReviewedAt: new Date('2026-10-01'),
    },
    {
      code: 'SATUSEHAT-PLAYBOOK',
      title: 'Pedoman interoperabilitas SATUSEHAT (HL7 FHIR R4, terminologi, playbook use-case)',
      status: 'DINAMIKA',
      note: 'Dokumen hidup; selalu utamakan dokumentasi resmi terbaru di satusehat.kemkes.go.id daripada contoh lama. Mapper FHIR dibuat berversi.',
      lastReviewedAt: new Date('2026-10-01'),
    },
  ]

  for (const g of regulasi) {
    await db.regulationRef.upsert({
      where: { code: g.code },
      update: { title: g.title, status: g.status, note: g.note, lastReviewedAt: g.lastReviewedAt },
      create: g,
    })
  }

  // ---------- Changelog rilis Fase 0 ----------
  await db.releaseLog.upsert({
    where: { id: 'release-0-1-0' },
    update: {},
    create: {
      id: 'release-0-1-0',
      phase: 'Fase 0 — Fondasi',
      version: '0.1.0',
      features: JSON.stringify([
        'Kerangka aplikasi multi-tenant: organisasi = satu tempat praktik mandiri (satu SIP penyelenggara)',
        'Masuk akun dengan sesi kedaluwarsa 12 jam, kata sandi ter-hash, pembatasan percobaan masuk',
        'Delapan peran bawaan (Penanggung Jawab, PPA, PPA Pendamping, Pendaftaran, Rekam Medis, Kasir, Pasien, Admin Teknis) dengan matriks izin yang bisa dipersempit',
        'Satu pengguna boleh tergabung di lebih dari satu praktik dengan peran berbeda',
        'Isolasi tenant: seluruh akses terlingkup organisasi aktif dari sesi server',
        'Jejak audit append-only: masuk, gagal masuk, keluar, pindah praktik, kelola pengguna, ubah sandi, ubah profil',
        'Profil tempat praktik beserta lokasi praktik',
        'Peta modul, rencana fase, changelog rilis, dan daftar regulasi yang dilacak',
        'Data contoh fiktif satu praktik, selalu ditandai CONTOH',
      ]),
      regulatoryImpact:
        'Menyiapkan fondasi kewajiban penyelenggaraan RME sesuai PMK 24/2022: autentikasi pengguna, kontrol akses berbasis peran, dan jejak audit. Belum ada data klinis dan belum ada klaim kepatuhan produksi; kepatuhan memerlukan peninjauan hukum, uji keamanan, dan proses registrasi oleh manusia.',
      migrationNote: 'Skema awal Fase 0. Tidak ada migrasi data dari sistem lain.',
      deferred: JSON.stringify([
        'Registrasi pasien, antrean, kunjungan (Fase 1)',
        'Catatan klinis dengan field wajib PMK 24/2022, versi, kunci catatan (Fase 2)',
        'Diagnosis ICD-10, tindakan ICD-9-CM, resep KFA (Fase 3)',
        'Resume kunjungan dan salinan pasien (Fase 4)',
        'Adapter SATUSEHAT: outbox, mapper FHIR, antrean sandbox (Fase 5)',
        'Portal pasien dan consent (Fase 6)',
        'Mutu, retensi, telemedisin, odontogram, templat profesi lain (Fase 7)',
        'Klaim dan rujukan (Fase 8)',
        'Verifikasi dua langkah untuk peran klinis dan penanggung jawab',
        'Enkripsi kolom data sensitif saat disimpan; dokumentasi RPO/RTO',
        'Integrasi BPJS Kesehatan / SISRUTE (antarmuka saja, tanpa integrasi palsu)',
      ]),
    },
  })

  console.log('Seed Fase 0 selesai.')
  console.log('Praktik contoh:', org.name)
  console.log('Kata sandi seluruh akun contoh:', KATA_SANDI_DEMO)
}

main()
  .catch((e) => {
    console.error('Seed gagal:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
