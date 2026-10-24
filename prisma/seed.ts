// ============================================================
// e-SIMANTRI — Seed Fase 0-2: data contoh fiktif (CONTOH)
//
// ATURAN: Jangan pernah menyimpan/memakai data pasien sungguhan di
// lingkungan demo. Seluruh nama, NIK, SIP, STR, alamat, dan kontak
// di berkas ini FIKTIF dan diberi penanda CONTOH. Data pasien
// contoh hanya untuk mencoba alur registrasi → kunjungan → catatan.
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const PASSWORD = 'Contoh123!'

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  // Bersihkan data fase 0-2 (hanya data contoh, aman di ulang)
  await db.clinicalNoteVersion.deleteMany()
  await db.clinicalNote.deleteMany()
  await db.encounter.deleteMany()
  await db.patient.deleteMany()
  await db.auditLog.deleteMany()
  await db.session.deleteMany()
  await db.membership.deleteMany()
  await db.user.deleteMany()
  await db.organization.deleteMany()

  // ---------- Praktik 1: dokter umum (CONTOH) ----------
  const praktikDokter = await db.organization.create({
    data: {
      name: 'Praktik Dokter Andi Wijaya (CONTOH)',
      practiceType: 'PRAKTIK_DOKTER',
      sipNumber: '445/1/CONTOH/2026',
      ownerName: 'dr. Andi Wijaya (CONTOH)',
      address: 'Jl. Melati Contoh No. 1, Kec. Contoh Kota',
      city: 'Kota Contoh',
      province: 'Jawa Barat',
      postalCode: '40000',
      phone: '(022) 555-0101',
      email: 'info@praktik-contoh.id',
      letterheadText:
        'PRAKTIK DOKTER ANDI WIJAYA (CONTOH) — Jl. Melati Contoh No. 1, Kota Contoh 40000 — Telp. (022) 555-0101 — Seluruh data fiktif untuk demonstrasi.',
      status: 'AKTIF',
    },
  })

  // ---------- Praktik 2: bidan (CONTOH) ----------
  const praktikBidan = await db.organization.create({
    data: {
      name: 'Praktik Bidan Dewi Lestari (CONTOH)',
      practiceType: 'PRAKTIK_BIDAN',
      sipNumber: '445/2/CONTOH/2026',
      ownerName: 'Dewi Lestari, Amd.Keb (CONTOH)',
      address: 'Jl. Anggrek Contoh No. 9, Kec. Contoh Selatan',
      city: 'Kota Contoh',
      province: 'Jawa Barat',
      postalCode: '40001',
      phone: '(022) 555-0202',
      email: 'salam@praktik-contoh.id',
      letterheadText:
        'PRAKTIK BIDAN DEWI LESTARI (CONTOH) — Jl. Anggrek Contoh No. 9, Kota Contoh 40001 — Telp. (022) 555-0202 — Seluruh data fiktif untuk demonstrasi.',
      status: 'AKTIF',
    },
  })

  // ---------- Pengguna (semua fiktif) ----------
  const andi = await db.user.create({
    data: {
      fullName: 'dr. Andi Wijaya (CONTOH)',
      email: 'andi@praktik-contoh.id',
      passwordHash,
      profession: 'Dokter Umum',
      strNumber: 'STR-CONTOH-0001',
      sipNumber: 'SIP-CONTOH-0001',
      isActive: true,
    },
  })

  const sari = await db.user.create({
    data: {
      fullName: 'Sari Rahma, Amd.Kep (CONTOH)',
      email: 'sari@praktik-contoh.id',
      passwordHash,
      profession: 'Perawat',
      strNumber: 'STR-CONTOH-0002',
      isActive: true,
    },
  })

  const rina = await db.user.create({
    data: {
      fullName: 'Rina Marlina (CONTOH)',
      email: 'rina@praktik-contoh.id',
      passwordHash,
      profession: 'Staf Administrasi',
      isActive: true,
    },
  })

  const tono = await db.user.create({
    data: {
      fullName: 'Tono Prakoso (CONTOH)',
      email: 'tono@praktik-contoh.id',
      passwordHash,
      profession: 'Petugas Rekam Medis',
      isActive: true,
    },
  })

  const budi = await db.user.create({
    data: {
      fullName: 'Budi Santoso (CONTOH)',
      email: 'budi@praktik-contoh.id',
      passwordHash,
      profession: 'Staf Kasir',
      isActive: true,
    },
  })

  const adminTeknis = await db.user.create({
    data: {
      fullName: 'Admin Teknis (CONTOH)',
      email: 'admin@praktik-contoh.id',
      passwordHash,
      profession: 'Dukungan Teknis',
      isActive: true,
    },
  })

  const dewi = await db.user.create({
    data: {
      fullName: 'Dewi Lestari, Amd.Keb (CONTOH)',
      email: 'dewi@praktik-contoh.id',
      passwordHash,
      profession: 'Bidan',
      strNumber: 'STR-CONTOH-0003',
      sipNumber: 'SIP-CONTOH-0003',
      isActive: true,
    },
  })

  // ---------- Keanggotaan ----------
  // dr. Andi: Penanggung Jawab + PPA di praktiknya; juga PPA tamu
  // di praktik bidan (menggambarkan keanggotaan lintas praktik).
  await db.membership.createMany({
    data: [
      { userId: andi.id, organizationId: praktikDokter.id, role: 'PENANGGUNG_JAWAB' },
      { userId: andi.id, organizationId: praktikDokter.id, role: 'PPA' },
      { userId: andi.id, organizationId: praktikBidan.id, role: 'PPA' },
      { userId: sari.id, organizationId: praktikDokter.id, role: 'PPA_PENDAMPING' },
      { userId: rina.id, organizationId: praktikDokter.id, role: 'PENDAFTARAN' },
      { userId: tono.id, organizationId: praktikDokter.id, role: 'REKAM_MEDIS' },
      { userId: budi.id, organizationId: praktikDokter.id, role: 'KASIR' },
      { userId: adminTeknis.id, organizationId: praktikDokter.id, role: 'ADMIN_TEKNIS' },
      { userId: dewi.id, organizationId: praktikBidan.id, role: 'PENANGGUNG_JAWAB' },
      { userId: dewi.id, organizationId: praktikBidan.id, role: 'PPA' },
    ],
  })

  // ---------- Jejak audit awal ----------
  await db.auditLog.createMany({
    data: [
      {
        organizationId: praktikDokter.id,
        action: 'INISIALISASI',
        objectType: 'Organization',
        objectId: praktikDokter.id,
        summary:
          'Data contoh fiktif (CONTOH) dibuat untuk Fase 0-2: profil praktik, pengguna, peran, pasien, kunjungan, catatan klinis, dan jejak audit. Seluruh data pasien FIKTIF.',
        ip: 'seed',
      },
      {
        organizationId: praktikBidan.id,
        action: 'INISIALISASI',
        objectType: 'Organization',
        objectId: praktikBidan.id,
        summary:
          'Data contoh fiktif (CONTOH) dibuat untuk Fase 0-2: profil praktik, pengguna, peran, dan jejak audit. Praktik bidan belum berisi pasien contoh.',
        ip: 'seed',
      },
    ],
  })

  // ============================================================
  // FASE 1-2 — Pasien, kunjungan, dan catatan klinis CONTOH
  // Seluruh pasien & isi klinis di bawah ini FIKTIF.
  // ============================================================

  const hariIni = new Date()
  const jam = (h: number, m: number) => {
    const d = new Date(hariIni)
    d.setHours(h, m, 0, 0)
    return d
  }
  const lalu = (hari: number, j: number, m: number) => {
    const d = new Date(hariIni)
    d.setDate(d.getDate() - hari)
    d.setHours(j, m, 0, 0)
    return d
  }

  const pasienSiti = await db.patient.create({
    data: {
      organizationId: praktikDokter.id,
      mrn: 'RM-0001',
      fullName: 'Siti Aminah (CONTOH)',
      nationalId: '3273010104850001',
      dateOfBirth: new Date('1985-01-01'),
      sex: 'PEREMPUAN',
      phone: '0812-1111-0001',
      address: 'Jl. Contoh Raya No. 10, Kota Contoh',
      payerType: 'BPJS',
      payerNumber: '0001234567890',
      createdByUserId: rina.id,
    },
  })
  const pasienJoko = await db.patient.create({
    data: {
      organizationId: praktikDokter.id,
      mrn: 'RM-0002',
      fullName: 'Joko Susilo (CONTOH)',
      nationalId: '3273010203700002',
      dateOfBirth: new Date('1970-02-03'),
      sex: 'LAKI_LAKI',
      phone: '0812-1111-0002',
      address: 'Jl. Contoh Indah No. 5, Kota Contoh',
      payerType: 'UMUM',
      createdByUserId: rina.id,
    },
  })
  const pasienAni = await db.patient.create({
    data: {
      organizationId: praktikDokter.id,
      mrn: 'RM-0003',
      fullName: 'Ani Wijayanti (CONTOH)',
      nationalId: '3273010304960003',
      dateOfBirth: new Date('1996-03-04'),
      sex: 'PEREMPUAN',
      phone: '0812-1111-0003',
      address: 'Jl. Contoh Damai No. 3, Kota Contoh',
      payerType: 'ASURANSI',
      payerNumber: 'ASR-CONTOH-777',
      createdByUserId: rina.id,
    },
  })
  const pasienBayu = await db.patient.create({
    data: {
      organizationId: praktikDokter.id,
      mrn: 'RM-0004',
      fullName: 'Bayu Kurniawan (CONTOH)',
      nationalId: '3273010404890004',
      dateOfBirth: new Date('1989-04-05'),
      sex: 'LAKI_LAKI',
      phone: '0812-1111-0004',
      address: 'Jl. Contoh Sejahtera No. 8, Kota Contoh',
      payerType: 'UMUM',
      createdByUserId: rina.id,
    },
  })

  // Kunjungan terkunci 1 — Joko, hipertensi (3 hari lalu)
  const encJoko = await db.encounter.create({
    data: {
      organizationId: praktikDokter.id,
      patientId: pasienJoko.id,
      status: 'SELESAI',
      openedAt: lalu(3, 9, 5),
      closedAt: lalu(3, 9, 45),
      registeredByUserId: rina.id,
      payerType: 'UMUM',
    },
  })
  await db.clinicalNote.create({
    data: {
      organizationId: praktikDokter.id,
      encounterId: encJoko.id,
      patientId: pasienJoko.id,
      authorUserId: andi.id,
      authorProfession: andi.profession,
      authorStrNumber: andi.strNumber,
      status: 'TERKUNCI',
      subjective:
        'Pusing kepala sejak 2 hari, terasa di belakang leher. Riwayat hipertensi sejak 2022, kadang berhenti minum obat bila merasa sehat. Tidak ada nyeri dada atau sesak.',
      allergiesNote: 'Tidak ada alergi obat yang diketahui. Tidak ada riwayat efek samping obat.',
      objective:
        'KU baik, BG 120/80 mmHg pada pemeriksaan ini, nadi 78x/menit reguler, sosok obesitas sentral. Jantung dan paru dalam batas normal.',
      supportingExam: null,
      assessment: 'Hipertensi terkontrol kurang — pasien tidak patuh minum obat (teks bebas, kode ICD-10 menyusul Fase 3).',
      plan: 'Lanjut amlodipin 10 mg 1x1. Edukasi kepatuhan minum obat dan diet rendah garam. Kontrol tekanan darah 2 minggu lagi.',
      medsGiven: 'Amlodipin 10 mg tab No. 30 (detail resep terstruktur menyusul Fase 3).',
      otherServices: null,
      education:
        'Pasien dan keluarga dijelaskan pentingnya minum obat teratur, membatasi garam, dan memantau tekanan darah mingguan. Pasien menyatakan mengerti.',
      followUpPlan: 'Kontrol 2 minggu lagi dengan membawa catatan tekanan darah rumah.',
      versionNumber: 1,
      lockedAt: lalu(3, 9, 45),
      lockedByUserId: andi.id,
    },
  })

  // Kunjungan terkunci 2 — Ani, ISK (1 hari lalu) + 1 amandemen (versi 1 tersimpan)
  const encAni = await db.encounter.create({
    data: {
      organizationId: praktikDokter.id,
      patientId: pasienAni.id,
      status: 'SELESAI',
      openedAt: lalu(1, 15, 10),
      closedAt: lalu(1, 15, 40),
      registeredByUserId: rina.id,
      payerType: 'ASURANSI',
      payerNumber: 'ASR-CONTOH-777',
    },
  })
  const catatanAni = await db.clinicalNote.create({
    data: {
      organizationId: praktikDokter.id,
      encounterId: encAni.id,
      patientId: pasienAni.id,
      authorUserId: andi.id,
      authorProfession: andi.profession,
      authorStrNumber: andi.strNumber,
      status: 'TERKUNCI',
      subjective:
        'Penging saat berkemih 3 hari, nyeri suprapubik ringan, urin keruh. Tidak ada demam atau nyeri pinggang. Riwayat ISK tahun lalu.',
      allergiesNote: 'Alergi sulfa — ruam setelah cotrimoxazole tahun 2022 (CONTOH).',
      objective:
        'KU baik, TD 110/70 mmHg, suhu 36,8°C. Suprapubik nyeri tekan ringan, CVA negatif bilateral.',
      supportingExam: 'Urine rutin (lab mitra CONTOH): lekosit esterase positif, nitrit positif.',
      assessment: 'Infeksi saluran kemung bawah tanpa komplikasi (teks bebas, kode ICD-10 menyusul Fase 3).',
      plan: 'Fosfomisin 3 g dosis tunggal. Banyak minum. Kembali bila demam, mual, atau nyeri pinggang (rujukan).',
      medsGiven: 'Fosfomisin 3 g sachet No. 1.',
      otherServices: null,
      education:
        'Dijelaskan tanda bahaya yang memerlukan kunjungan segera dan pentingnya melengkapi dosis. Pasien mengerti.',
      followUpPlan: 'Kontrol 3 hari bila keluhan berlanjut.',
      versionNumber: 1,
      lockedAt: lalu(1, 15, 40),
      lockedByUserId: andi.id,
    },
  })
  // Versi 1 tersimpan (contoh amandemen): diagnosis awal sempat salah ketik.
  await db.clinicalNoteVersion.create({
    data: {
      noteId: catatanAni.id,
      versionNumber: 1,
      subjective:
        'Penging saat berkemih 3 hari, nyeri suprapubik ringan, urin keruh. Tidak ada demam atau nyeri pinggang. Riwayat ISK tahun lalu.',
      allergiesNote: 'Alergi sulfa — ruam setelah cotrimoxazole tahun 2022 (CONTOH).',
      objective: 'KU baik, TD 110/70 mmHg, suhu 38,6°C. Suprapubik nyeri tekan ringan, CVA negatif bilateral.',
      supportingExam: 'Urine rutin (lab mitra CONTOH): lekosit esterase positif, nitrit positif.',
      assessment: 'Infeksi saluran kemung bawah dengan demam (teks bebas, kode ICD-10 menyusul Fase 3).',
      plan: 'Fosfomisin 3 g dosis tunggal. Banyak minum. Kembali bila demam, mual, atau nyeri pinggang (rujukan).',
      medsGiven: 'Fosfomisin 3 g sachet No. 1.',
      otherServices: null,
      education: 'Dijelaskan tanda bahaya yang memerlukan kunjungan segera. Pasien mengerti.',
      followUpPlan: 'Kontrol 3 hari bila keluhan berlanjut.',
      status: 'TERKUNCI',
      reason: 'Koreksi suhu pemeriksaan: tertulis 38,6°C, yang benar 36,8°C (salah salin dari formulir kertas).',
      changedByUserId: andi.id,
      changedByName: andi.fullName,
      createdAt: lalu(1, 16, 2),
    },
  })
  // Catatan Ani kini versi 2 (isi final di atas).
  await db.clinicalNote.update({
    where: { id: catatanAni.id },
    data: { versionNumber: 2 },
  })

  // Kunjungan berlangsung + draf catatan — Siti (hari ini)
  const encSiti = await db.encounter.create({
    data: {
      organizationId: praktikDokter.id,
      patientId: pasienSiti.id,
      status: 'DALAM_PROSES',
      openedAt: jam(8, 30),
      registeredByUserId: rina.id,
      payerType: 'BPJS',
      payerNumber: '0001234567890',
    },
  })
  await db.clinicalNote.create({
    data: {
      organizationId: praktikDokter.id,
      encounterId: encSiti.id,
      patientId: pasienSiti.id,
      authorUserId: andi.id,
      status: 'DRAF',
      subjective: 'Kontrol rutin kehamilan 26 minggu, tanpa keluhan. Janji bergerak baik.',
      allergiesNote: 'Tidak ada alergi yang diketahui.',
      objective: '',
      assessment: '',
      plan: '',
      medsGiven: '',
      education: '',
      versionNumber: 1,
    },
  })

  // Kunjungan hari ini tanpa catatan — Bayu (untuk dasbor kelengkapan)
  const encBayu = await db.encounter.create({
    data: {
      organizationId: praktikDokter.id,
      patientId: pasienBayu.id,
      status: 'DALAM_PROSES',
      openedAt: jam(9, 15),
      registeredByUserId: rina.id,
      payerType: 'UMUM',
    },
  })
  void encBayu

  await db.organization.update({
    where: { id: praktikDokter.id },
    data: { mrnCounter: 4 },
  })

  console.log('Seed Fase 0-2 selesai (data fiktif CONTOH):')
  console.log(`- 2 praktik: "${praktikDokter.name}", "${praktikBidan.name}"`)
  console.log('- 7 pengguna fiktif, 10 keanggotaan, kata sandi semua akun:', PASSWORD)
  console.log('- 4 pasien fiktif (RM-0001 s.d. RM-0004), 4 kunjungan, 3 catatan (2 terkunci, 1 draf).')
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
