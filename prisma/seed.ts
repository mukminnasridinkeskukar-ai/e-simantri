// ============================================================
// e-SIMANTRI — Seed Fase 0-3: data contoh fiktif (CONTOH)
//
// ATURAN: Jangan pernah menyimpan/memakai data pasien sungguhan di
// lingkungan demo. Seluruh nama, NIK, SIP, STR, alamat, dan kontak
// di berkas ini FIKTIF dan diberi penanda CONTOH. Data pasien
// contoh hanya untuk mencoba alur registrasi → kunjungan → catatan
// → kodifikasi → resep.
//
// KATALOG TERMINOLOGI: kode ICD-10/ICD-9-CM di bawah memakai kode
// nyata yang umum (judul diringkas), sedangkan kode KFA memakai
// format SINTETIS (KFA-xxxx) karena katalog resmi tidak boleh
// dipalsukan. Keduanya ditandai isSeedDemo=true dan HANYA SUBSET
// untuk demo — produksi wajib mengimpor katalog resmi Kemenkes.
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const PASSWORD = 'Contoh123!'

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  // Bersihkan data fase 0-3 (hanya data contoh, aman di ulang)
  await db.prescriptionItem.deleteMany()
  await db.prescription.deleteMany()
  await db.noteDiagnosis.deleteMany()
  await db.noteProcedure.deleteMany()
  await db.clinicalNoteVersion.deleteMany()
  await db.clinicalNote.deleteMany()
  await db.encounter.deleteMany()
  await db.patient.deleteMany()
  await db.auditLog.deleteMany()
  await db.session.deleteMany()
  await db.membership.deleteMany()
  await db.user.deleteMany()
  await db.organization.deleteMany()
  // Katalog referensi global — diunggah ulang tiap seed CONTOH.
  // Produksi TIDAK memakai seed ini (lihat seed-admin.ts + DEPLOYMENT.md).
  await db.icd10Code.deleteMany()
  await db.icd9CmCode.deleteMany()
  await db.kfaCode.deleteMany()

  // ============================================================
  // FASE 3 — Katalog referensi SUBSET CONTOH
  // ============================================================

  const icd10Seed: { code: string; description: string; chapter: string }[] = [
    { code: 'A09.0', description: 'Gastroenteritis dan kolitis infeksius lain dan yang tidak ditentukan', chapter: 'I' },
    { code: 'A90', description: 'Demam dengue', chapter: 'I' },
    { code: 'A91', description: 'Demam berdarah dengue', chapter: 'I' },
    { code: 'B34.9', description: 'Infeksi virus tanpa spesifikasi lokasi', chapter: 'I' },
    { code: 'D50.9', description: 'Anemia defisiensi besi tanpa spesifikasi', chapter: 'III' },
    { code: 'D64.9', description: 'Anemia tanpa spesifikasi', chapter: 'III' },
    { code: 'E11.9', description: 'Diabetes melitus tipe 2 tanpa komplikasi', chapter: 'IV' },
    { code: 'E55.9', description: 'Defisiensi vitamin D tanpa spesifikasi', chapter: 'IV' },
    { code: 'E66.9', description: 'Obesitas tanpa spesifikasi', chapter: 'IV' },
    { code: 'H10.9', description: 'Konjungtivitis tanpa spesifikasi', chapter: 'VII' },
    { code: 'H66.9', description: 'Otitis media tanpa spesifikasi', chapter: 'VIII' },
    { code: 'I10', description: 'Hipertensi esensial (primer)', chapter: 'IX' },
    { code: 'I48', description: 'Fibrilasi atrial dan flutter atrial', chapter: 'IX' },
    { code: 'J00', description: 'Nazofaringitis akut (flu biasa)', chapter: 'X' },
    { code: 'J02.9', description: 'Faringitis akut tanpa spesifikasi', chapter: 'X' },
    { code: 'J03.9', description: 'Tonsilitis akut tanpa spesifikasi', chapter: 'X' },
    { code: 'J06.9', description: 'Infeksi akut saluran napas atas tanpa spesifikasi', chapter: 'X' },
    { code: 'J18.9', description: 'Pneumonia tanpa spesifikasi organisme', chapter: 'X' },
    { code: 'J20.9', description: 'Bronkitis akut tanpa spesifikasi', chapter: 'X' },
    { code: 'J30.4', description: 'Rinitis alergi tanpa spesifikasi', chapter: 'X' },
    { code: 'J45.9', description: 'Asma tanpa spesifikasi', chapter: 'X' },
    { code: 'K02.9', description: 'Karies gigi tanpa spesifikasi', chapter: 'XI' },
    { code: 'K04.0', description: 'Pulpitis', chapter: 'XI' },
    { code: 'K05.1', description: 'Gingivitis kronis', chapter: 'XI' },
    { code: 'K21.0', description: 'Penyakit refluks gastroesofageal dengan esofagitis', chapter: 'XI' },
    { code: 'K29.7', description: 'Gastritis tanpa spesifikasi', chapter: 'XI' },
    { code: 'K30', description: 'Dispepsia (indigesti)', chapter: 'XI' },
    { code: 'K52.9', description: 'Gastroenteritis dan kolitis noninfeksi tanpa spesifikasi', chapter: 'XI' },
    { code: 'K59.0', description: 'Konstipasi', chapter: 'XI' },
    { code: 'K76.0', description: 'Penyakit hati berlemak, tidak diklasifikasikan di tempat lain', chapter: 'XI' },
    { code: 'L23.9', description: 'Dermatitis kontak alergi, penyebab tanpa spesifikasi', chapter: 'XII' },
    { code: 'L24.9', description: 'Dermatitis kontak iritan, penyebab tanpa spesifikasi', chapter: 'XII' },
    { code: 'L50.9', description: 'Urtikaria tanpa spesifikasi', chapter: 'XII' },
    { code: 'M17.9', description: 'Osteoartritis lutut tanpa spesifikasi', chapter: 'XIII' },
    { code: 'M54.5', description: 'Nyeri punggung bawah', chapter: 'XIII' },
    { code: 'M79.1', description: 'Mialgia', chapter: 'XIII' },
    { code: 'N30.0', description: 'Sistitis akut', chapter: 'XIV' },
    { code: 'N39.0', description: 'Infeksi saluran kemih tanpa spesifikasi lokasi', chapter: 'XIV' },
    { code: 'N76.0', description: 'Vaginitis akut', chapter: 'XIV' },
    { code: 'O80', description: 'Persalinan tunggal spontan', chapter: 'XV' },
    { code: 'R05', description: 'Batuk', chapter: 'XVIII' },
    { code: 'R10.4', description: 'Nyeri abdomen lain dan yang tidak ditentukan (kolik abdomen)', chapter: 'XVIII' },
    { code: 'R50.9', description: 'Demam tanpa spesifikasi', chapter: 'XVIII' },
    { code: 'R51', description: 'Sakit kepala', chapter: 'XVIII' },
    { code: 'Z00.0', description: 'Pemeriksaan kesehatan umum', chapter: 'XXI' },
    { code: 'Z34.9', description: 'Pengawasan kehamilan normal tanpa spesifikasi', chapter: 'XXI' },
  ]
  await db.icd10Code.createMany({ data: icd10Seed.map((c) => ({ ...c, isSeedDemo: true })) })

  const icd9Seed: { code: string; description: string; chapter: string }[] = [
    { code: '21.1', description: 'Kontrol perdarahan hidung (epistaksis)', chapter: 'THT' },
    { code: '41.31', description: 'Pungsi vena (pengambilan sampel darah vena)', chapter: 'Laboratorium' },
    { code: '86.3', description: 'Insisi dan drainase kulit dan jaringan subkutan', chapter: 'Kulit' },
    { code: '87.16', description: 'Rontgen toraks dua pandangan', chapter: 'Radiologi' },
    { code: '87.41', description: 'Rontgen rahang dan gigi', chapter: 'Radiologi' },
    { code: '88.61', description: 'SCT (CT scan) kepala', chapter: 'Radiologi' },
    { code: '88.71', description: 'Ultrasonografi diagnostik abdomen lengkap', chapter: 'Radiologi' },
    { code: '88.72', description: 'Ekokardiografi diagnostik', chapter: 'Radiologi' },
    { code: '93.94', description: 'Fisioterapi lainnya', chapter: 'Rehabilitasi' },
    { code: '99.18', description: 'Injeksi atau infus insulin', chapter: 'Farmasi' },
    { code: '99.21', description: 'Injeksi antibiotik', chapter: 'Farmasi' },
    { code: '99.39', description: 'Injeksi atau infus zat terapi/profilaksi lainnya', chapter: 'Farmasi' },
  ]
  await db.icd9CmCode.createMany({ data: icd9Seed.map((c) => ({ ...c, isSeedDemo: true })) })

  const kfaSeed: { code: string; name: string; dosageForm: string; strength: string; unit: string }[] = [
    { code: 'KFA-0001', name: 'Paracetamol', dosageForm: 'Tablet', strength: '500 mg', unit: 'tablet' },
    { code: 'KFA-0002', name: 'Amoksisilin', dosageForm: 'Kapsul', strength: '500 mg', unit: 'kapsul' },
    { code: 'KFA-0003', name: 'Sefiksim', dosageForm: 'Kapsul', strength: '100 mg', unit: 'kapsul' },
    { code: 'KFA-0004', name: 'Azitromisin', dosageForm: 'Tablet', strength: '500 mg', unit: 'tablet' },
    { code: 'KFA-0005', name: 'Ibuprofen', dosageForm: 'Tablet', strength: '400 mg', unit: 'tablet' },
    { code: 'KFA-0006', name: 'Amlodipin', dosageForm: 'Tablet', strength: '10 mg', unit: 'tablet' },
    { code: 'KFA-0007', name: 'Kaptopril', dosageForm: 'Tablet', strength: '25 mg', unit: 'tablet' },
    { code: 'KFA-0008', name: 'Metformin', dosageForm: 'Tablet', strength: '500 mg', unit: 'tablet' },
    { code: 'KFA-0009', name: 'Glibenklamid', dosageForm: 'Tablet', strength: '5 mg', unit: 'tablet' },
    { code: 'KFA-0010', name: 'Omeprazol', dosageForm: 'Kapsul', strength: '20 mg', unit: 'kapsul' },
    { code: 'KFA-0011', name: 'Ranitidin', dosageForm: 'Tablet', strength: '150 mg', unit: 'tablet' },
    { code: 'KFA-0012', name: 'Cetirizin', dosageForm: 'Tablet', strength: '10 mg', unit: 'tablet' },
    { code: 'KFA-0013', name: 'Loratadin', dosageForm: 'Tablet', strength: '10 mg', unit: 'tablet' },
    { code: 'KFA-0014', name: 'Salbutamol', dosageForm: 'Inhaler', strength: '100 mcg/dosis', unit: 'dosis' },
    { code: 'KFA-0015', name: 'Prednison', dosageForm: 'Tablet', strength: '5 mg', unit: 'tablet' },
    { code: 'KFA-0016', name: 'Deksametason', dosageForm: 'Tablet', strength: '0,5 mg', unit: 'tablet' },
    { code: 'KFA-0017', name: 'Garam rehidrasi oral (ORS)', dosageForm: 'Sachet', strength: '20,5 g', unit: 'sachet' },
    { code: 'KFA-0018', name: 'Fosfomisin', dosageForm: 'Sachet', strength: '3 g', unit: 'sachet' },
    { code: 'KFA-0019', name: 'Vitamin B kompleks', dosageForm: 'Tablet', strength: '', unit: 'tablet' },
    { code: 'KFA-0020', name: 'Asam mefenamat', dosageForm: 'Tablet', strength: '500 mg', unit: 'tablet' },
    { code: 'KFA-0021', name: 'Gentamisin', dosageForm: 'Injeksi', strength: '80 mg/2 ml', unit: 'ampul' },
    { code: 'KFA-0022', name: 'Betametason', dosageForm: 'Salep', strength: '0,1%', unit: 'tube' },
  ]
  await db.kfaCode.createMany({
    data: kfaSeed.map((k) => ({ code: k.code, name: k.name, dosageForm: k.dosageForm, strength: k.strength || null, unit: k.unit, isSeedDemo: true })),
  })

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
          'Data contoh fiktif (CONTOH) dibuat untuk Fase 0-3: profil praktik, pengguna, peran, pasien, kunjungan, catatan klinis, kodifikasi ICD-10/ICD-9-CM, resep terstruktur, dan jejak audit. Seluruh data pasien FIKTIF. Katalog terminologi adalah subset contoh — produksi mengimpor katalog resmi Kemenkes.',
        ip: 'seed',
      },
      {
        organizationId: praktikBidan.id,
        action: 'INISIALISASI',
        objectType: 'Organization',
        objectId: praktikBidan.id,
        summary:
          'Data contoh fiktif (CONTOH) dibuat untuk Fase 0-3: profil praktik, pengguna, peran, dan jejak audit. Praktik bidan belum berisi pasien contoh.',
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
  const catatanJoko = await db.clinicalNote.create({
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
      assessment: 'Hipertensi terkontrol kurang — pasien tidak patuh minum obat.',
      plan: 'Lanjut amlodipin 10 mg 1x1. Edukasi kepatuhan minum obat dan diet rendah garam. Kontrol tekanan darah 2 minggu lagi.',
      medsGiven: 'Amlodipin 10 mg tab No. 30.',
      otherServices: null,
      education:
        'Pasien dan keluarga dijelaskan pentingnya minum obat teratur, membatasi garam, dan memantau tekanan darah mingguan. Pasien menyatakan mengerti.',
      followUpPlan: 'Kontrol 2 minggu lagi dengan membawa catatan tekanan darah rumah.',
      versionNumber: 1,
      lockedAt: lalu(3, 9, 45),
      lockedByUserId: andi.id,
    },
  })
  // Fase 3 — kodifikasi CONTOH pada catatan terkunci Joko.
  const icd10I10 = await db.icd10Code.findUniqueOrThrow({ where: { code: 'I10' } })
  const kfaAmlodipin = await db.kfaCode.findUniqueOrThrow({ where: { code: 'KFA-0006' } })
  await db.noteDiagnosis.create({
    data: {
      organizationId: praktikDokter.id,
      noteId: catatanJoko.id,
      icd10CodeId: icd10I10.id,
      isPrimary: true,
      noteText: 'Terkontrol kurang — tidak patuh minum obat',
      enteredByUserId: andi.id,
      lockedAt: lalu(3, 9, 45),
    },
  })
  await db.prescription.create({
    data: {
      organizationId: praktikDokter.id,
      noteId: catatanJoko.id,
      number: 'RESEP-0001',
      status: 'AKTIF',
      createdByUserId: andi.id,
      items: {
        create: {
          kfaCodeId: kfaAmlodipin.id,
          drugName: 'Amlodipin 10 mg',
          dose: '1 tablet',
          route: 'ORAL',
          frequency: '1x sehari',
          durationDays: 30,
          quantity: 'No. 30',
          instructions: 'pagi setelah sarapan',
        },
      },
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
      assessment: 'Infeksi saluran kemih bawah tanpa komplikasi.',
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
  // Fase 3 — kodifikasi CONTOH pada catatan terkunci Ani.
  const icd10N390 = await db.icd10Code.findUniqueOrThrow({ where: { code: 'N39.0' } })
  const kfaFosfomisin = await db.kfaCode.findUniqueOrThrow({ where: { code: 'KFA-0018' } })
  await db.noteDiagnosis.create({
    data: {
      organizationId: praktikDokter.id,
      noteId: catatanAni.id,
      icd10CodeId: icd10N390.id,
      isPrimary: true,
      noteText: 'Tanpa komplikasi, gejala ringan',
      enteredByUserId: andi.id,
      lockedAt: lalu(1, 15, 40),
    },
  })
  await db.prescription.create({
    data: {
      organizationId: praktikDokter.id,
      noteId: catatanAni.id,
      number: 'RESEP-0002',
      status: 'AKTIF',
      createdByUserId: andi.id,
      items: {
        create: {
          kfaCodeId: kfaFosfomisin.id,
          drugName: 'Fosfomisin 3 g',
          dose: '1 sachet',
          route: 'ORAL',
          frequency: 'dosis tunggal',
          durationDays: null,
          quantity: 'No. 1',
          instructions: 'larutkan dalam segelas air, minum sebelum tidur',
        },
      },
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
      assessment: 'Infeksi saluran kemung bawah dengan demam.',
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
  const catatanSiti = await db.clinicalNote.create({
    data: {
      organizationId: praktikDokter.id,
      encounterId: encSiti.id,
      patientId: pasienSiti.id,
      authorUserId: andi.id,
      status: 'DRAF',
      subjective: 'Kontrol rutin kehamilan 26 minggu, tanpa keluhan. Janin bergerak baik.',
      allergiesNote: 'Tidak ada alergi yang diketahui.',
      objective: '',
      assessment: '',
      plan: '',
      medsGiven: '',
      education: '',
      versionNumber: 1,
    },
  })
  // Fase 3 — contoh kode pada DRAF (masih dapat diubah penulisnya).
  const icd10Z349 = await db.icd10Code.findUniqueOrThrow({ where: { code: 'Z34.9' } })
  await db.noteDiagnosis.create({
    data: {
      organizationId: praktikDokter.id,
      noteId: catatanSiti.id,
      icd10CodeId: icd10Z349.id,
      isPrimary: true,
      noteText: 'Kehamilan 26 minggu',
      enteredByUserId: andi.id,
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
    data: { mrnCounter: 4, rxCounter: 2 },
  })

  console.log('Seed Fase 0-3 selesai (data fiktif CONTOH):')
  console.log(`- 2 praktik: "${praktikDokter.name}", "${praktikBidan.name}"`)
  console.log('- 7 pengguna fiktif, 10 keanggotaan, kata sandi semua akun:', PASSWORD)
  console.log('- 4 pasien fiktif (RM-0001 s.d. RM-0004), 4 kunjungan, 3 catatan (2 terkunci, 1 draf).')
  console.log('- Katalog SUBSET CONTOH: 47 ICD-10, 12 ICD-9-CM, 22 KFA.')
  console.log('- Kodifikasi CONTOH: 3 diagnosis (2 pada catatan terkunci, 1 pada draf); 2 resep (RESEP-0001/0002).')
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
