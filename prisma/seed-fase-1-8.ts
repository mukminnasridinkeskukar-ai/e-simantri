// ============================================================
// SEED e-SIMANTRI — Fase 1–8
// Data klinis contoh FIKTIF. Semua nama, NIK, nomor, dan nilai klinis
// adalah karangan dan ditandai CONTOH. Bukan data pasien sungguhan.
// Jalankan: bun prisma/seed-fase-1-8.ts  (setelah prisma/seed.ts)
// ============================================================

import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const db = new PrismaClient()

const ORG_ID = 'org-contoh-sehat-sentosa'
const KODE_PORTAL_DEMO = '482913'

function hashKode(kode: string): string {
  return createHash('sha256').update(kode).digest('hex')
}

const jam = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000)

const ICD10 = [
  ['A09', 'Diare dan gastroenteritis yang diduga infeksi'],
  ['A91', 'Demam berdarah dengue'],
  ['B01.9', 'Varisela tanpa komplikasi'],
  ['D50.9', 'Anemia defisiensi besi, tanpa keterangan'],
  ['E11.9', 'Diabetes melitus tipe 2 tanpa komplikasi'],
  ['E78.5', 'Hiperlipidemia, tidak spesifik'],
  ['F32.9', 'Episode depresif, tidak spesifik'],
  ['F41.1', 'Gangguan kecemasan menyeluruh'],
  ['H10.9', 'Konjungtivitis, tidak spesifik'],
  ['I10', 'Hipertensi esensial (primer)'],
  ['I63.9', 'Infark serebral, tidak spesifik'],
  ['J02.9', 'Faringitis akut, tidak spesifik'],
  ['J03.9', 'Tonsilitis akut, tidak spesifik'],
  ['J06.9', 'Infeksi saluran napas akut atas, tidak spesifik'],
  ['J44.9', 'Penyakit paru obstruktif kronik, tidak spesifik'],
  ['J45.9', 'Asma, tidak spesifik'],
  ['K02.9', 'Karies gigi, tidak spesifik'],
  ['K05.1', 'Gingivitis kronis'],
  ['K21.9', 'Penyakit refluks gastroesofageal tanpa esofagitis'],
  ['K29.7', 'Gastritis, tidak spesifik'],
  ['K30', 'Dispepsia'],
  ['L30.9', 'Dermatitis, tidak spesifik'],
  ['M54.5', 'Nyeri pinggang bawah'],
  ['M79.1', 'Mialgia'],
  ['N39.0', 'Infeksi saluran kemih, lokasi tidak spesifik'],
  ['O80', 'Persalinan tunggal spontan'],
  ['R05', 'Batuk'],
  ['R50.9', 'Demam, tidak spesifik'],
  ['R51', 'Sakit kepala'],
  ['T78.4', 'Alergi, tidak spesifik'],
  ['U07.1', 'COVID-19, virus teridentifikasi'],
  ['Z00.0', 'Pemeriksaan kesehatan umum umum'],
  ['Z34.0', 'Pemantauan kehamilan normal, kali pertama'],
  ['K05.3', 'Periodontitis kronis'],
  ['K08.9', 'Gangguan gigi dan jaringan penunjang, tidak spesifik'],
  ['H66.9', 'Otitis media, tidak spesifik'],
]

const ICD9CM = [
  ['87.44', 'Rontgen dada rutin, minimal dua sisi'],
  ['96.04', 'Pemasangan selang endotrakeal'],
  ['86.3', 'Pengangkatan lesi atau jaringan kulit'],
  ['93.94', 'Fisioterapi tanpa klasifikasi lain'],
  ['96.99', 'Perawatan lain pada luka'],
  ['88.72', 'Ultrasonografi diagnostik jantung'],
]

// KFA: KODE & nama CONTOH — bukan katalog resmi. Di produksi, daftar diambil
// dari Katalog Farmasi dan Alat Kesehatan (KFA) melalui modul terminologi.
const KFA = [
  ['KFA-CONTOH-0001', 'Paracetamol', '500 mg', 'tablet'],
  ['KFA-CONTOH-0002', 'Amoksisilin', '500 mg', 'kapsul'],
  ['KFA-CONTOH-0003', 'Sefadroksil', '500 mg', 'kapsul'],
  ['KFA-CONTOH-0004', 'Azitromisin', '500 mg', 'tablet'],
  ['KFA-CONTOH-0005', 'Ibuprofen', '400 mg', 'tablet'],
  ['KFA-CONTOH-0006', 'Setirizin', '10 mg', 'tablet'],
  ['KFA-CONTOH-0007', 'Loratadin', '10 mg', 'tablet'],
  ['KFA-CONTOH-0008', 'Omeprazol', '20 mg', 'kapsul'],
  ['KFA-CONTOH-0009', 'Antasida DOEN', 'suspensi', 'botol'],
  ['KFA-CONTOH-0010', 'Metformin', '500 mg', 'tablet'],
  ['KFA-CONTOH-0011', 'Kandesartan', '8 mg', 'tablet'],
  ['KFA-CONTOH-0012', 'Salbutamol', '100 mcg/dosis', 'inhaler'],
  ['KFA-CONTOH-0013', 'Prednison', '5 mg', 'tablet'],
  ['KFA-CONTOH-0014', 'ORC (oralit)', 'sachet', 'serbuk'],
  ['KFA-CONTOH-0015', 'Povidon Iodin 10%', 'larutan', 'botol'],
  ['KFA-CONTOH-0016', 'Vitamin B kompleks', 'tablet', 'tablet'],
]

async function terminologi() {
  for (const [code, display] of ICD10) {
    await db.terminologyCode.upsert({
      where: { id: `icd10-${code.replace('.', '-')}` },
      update: {},
      create: { id: `icd10-${code.replace('.', '-')}`, organizationId: null, system: 'ICD10', code, display },
    })
  }
  for (const [code, display] of ICD9CM) {
    await db.terminologyCode.upsert({
      where: { id: `icd9cm-${code.replace('.', '-')}` },
      update: {},
      create: { id: `icd9cm-${code.replace('.', '-')}`, organizationId: null, system: 'ICD9CM', code, display },
    })
  }
  for (const [code, display, strength, form] of KFA) {
    await db.terminologyCode.upsert({
      where: { id: `kfa-${code.toLowerCase()}` },
      update: {},
      create: { id: `kfa-${code.toLowerCase()}`, organizationId: null, system: 'KFA', code, display, extra: `${strength} · ${form}` },
    })
  }
}

const PASIEN = [
  {
    id: 'pasien-contoh-1',
    medicalRecordNumber: 'RM-00001',
    nik: '3204999901880001',
    name: 'Siti Aminah (CONTOH)',
    dateOfBirth: new Date(1988, 0, 10),
    sex: 'PEREMPUAN',
    phone: '0813-0000-0001 (CONTOH)',
    address: 'Jl. Contoh No. 1, Kota Contoh (ALAMAT CONTOH)',
    bloodType: 'O',
    allergiesNote: 'Tidak ada riwayat alergi yang diketahui (CONTOH)',
  },
  {
    id: 'pasien-contoh-2',
    medicalRecordNumber: 'RM-00002',
    nik: '3204999901750002',
    name: 'Agus Salim (CONTOH)',
    dateOfBirth: new Date(1975, 5, 20),
    sex: 'LAKI_LAKI',
    phone: '0813-0000-0002 (CONTOH)',
    address: 'Jl. Contoh No. 2, Kota Contoh (ALAMAT CONTOH)',
    bloodType: 'B',
    allergiesNote: 'Alergi obat: tidak diketahui (CONTOH)',
  },
  {
    id: 'pasien-contoh-3',
    medicalRecordNumber: 'RM-00003',
    nik: null,
    name: 'Rina Marlina (CONTOH)',
    dateOfBirth: new Date(1992, 8, 3),
    sex: 'PEREMPUAN',
    phone: '0813-0000-0003 (CONTOH)',
    address: 'Jl. Contoh No. 3, Kota Contoh (ALAMAT CONTOH)',
    bloodType: 'A',
    allergiesNote: 'Tidak ada riwayat alergi (CONTOH)',
  },
  {
    id: 'pasien-contoh-4',
    medicalRecordNumber: 'RM-00004',
    nik: '3204999902000004',
    name: 'Dimas Prayoga (CONTOH)',
    dateOfBirth: new Date(2000, 2, 15),
    sex: 'LAKI_LAKI',
    phone: '0813-0000-0004 (CONTOH)',
    address: 'Jl. Contoh No. 4, Kota Contoh (ALAMAT CONTOH)',
    bloodType: null,
    allergiesNote: 'Alergi makanan: seafood (CONTOH)',
  },
  {
    id: 'pasien-contoh-5',
    medicalRecordNumber: 'RM-00005',
    nik: '3204999901650005',
    name: 'Kartika Wulan (CONTOH)',
    dateOfBirth: new Date(1965, 11, 30),
    sex: 'PEREMPUAN',
    phone: '0813-0000-0005 (CONTOH)',
    address: 'Jl. Contoh No. 5, Kota Contoh (ALAMAT CONTOH)',
    bloodType: 'AB',
    allergiesNote: 'Alergi obat: penisilin (CONTOH)',
  },
  {
    id: 'pasien-contoh-6',
    medicalRecordNumber: 'RM-00006',
    nik: '3204999901800006',
    name: 'Yusuf Hidayat (CONTOH)',
    dateOfBirth: new Date(1980, 3, 8),
    sex: 'LAKI_LAKI',
    phone: '0813-0000-0006 (CONTOH)',
    address: 'Jl. Contoh No. 6, Kota Contoh (ALAMAT CONTOH)',
    bloodType: 'O',
    allergiesNote: 'Tidak ada riwayat alergi yang diketahui (CONTOH)',
  },
]

async function pasien() {
  for (const p of PASIEN) {
    await db.patient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        organizationId: ORG_ID,
        medicalRecordNumber: p.medicalRecordNumber,
        nik: p.nik,
        name: p.name,
        dateOfBirth: p.dateOfBirth,
        sex: p.sex,
        phone: p.phone,
        address: p.address,
        bloodType: p.bloodType,
        allergiesNote: p.allergiesNote,
        payerType: 'UANG_SENDIRI',
        isSample: true,
      },
    })
  }
}

const isiUmumPenuh = {
  anamnesis: {
    keluhan_utama: 'Nyeri pada luka jari tangan kiri sejak 3 hari, keluar nanah (CONTOH).',
    riwayat_sekarang: 'Luka tergores 3 hari lalu, semakin nyeri, memerah, ada nanah (CONTOH).',
    riwayat_dahulu: 'Tidak ada penyakit kronis (CONTOH).',
    alergi: 'Tidak ada riwayat alergi',
    alergi_detail: '',
    obat_dipakai: 'Tidak ada (CONTOH).',
  },
  tanda_vital: { td: '118/76', nadi: '84', suhu: '37.2', rr: '18', spo2: '98', berat: '58', tinggi: '162' },
  pemeriksaan: {
    kepala_leher: 'Anikterik, tidak ada limfadenopati (CONTOH).',
    dada: 'Jantung dan paru dalam batas normal (CONTOH).',
    perut: 'Perut lembut, tidak nyeri (CONTOH).',
    ekstremitas: 'Luka pada jari 2 tangan kiri dengan tanda infeksi ringan (CONTOH).',
    lainnya: '',
  },
  penunjang: { ringkasan: '' },
  rencana: {
    tatalaksana: 'Perawatan luka, antibiotik oral 5 hari (CONTOH).',
    edukasi: 'Cara merawat luka di rumah, tanda bahaya (CONTOH).',
    tindak_lanjut: 'Kontrol 3 hari bila tidak membaik (CONTOH).',
  },
}

const isiUmumKurang = {
  anamnesis: {
    keluhan_utama: 'Pusing dan lelah sejak 2 minggu (CONTOH).',
    riwayat_sekarang: 'Tekanan darah sering tinggi, belum rutin minum obat (CONTOH).',
    riwayat_dahulu: 'Hipertensi (CONTOH).',
    alergi: 'Ada — dijelaskan di bawah',
    alergi_detail: 'Penisilin (CONTOH).',
    obat_dipakai: 'Kandesartan 8 mg, tidak teratur (CONTOH).',
  },
  tanda_vital: { td: '158/95', nadi: '88', suhu: '36.8', rr: '20', spo2: '97', berat: '70', tinggi: '158' },
  pemeriksaan: {
    kepala_leher: 'Normal (CONTOH).',
    dada: 'Paru bersih (CONTOH).',
    perut: 'Normal (CONTOH).',
    // ekstremitas sengaja kosong — untuk demo penghenti penguncian
    lainnya: '',
  },
  penunjang: { ringkasan: '' },
  rencana: {
    tatalaksana: 'Ajukan diet rendah garam (CONTOH).',
    // edukasi sengaja kosong — untuk demo penghenti penguncian
    tindak_lanjut: 'Kontrol 2 minggu (CONTOH).',
  },
}

const isiGigi = {
  anamnesis: {
    keluhan_utama: 'Gigi geraham kanan bawah nyeri sejak 4 hari (CONTOH).',
    riwayat_sekarang: 'Nyeri berdenyut, memburuk saat makan manis (CONTOH).',
    riwayat_dahulu: 'Tidak ada riwayat penyakit khusus (CONTOH).',
    alergi: 'Ada — dijelaskan di bawah',
    alergi_detail: 'Seafood (CONTOH).',
    obat_dipakai: 'Paracetamol sewaktu nyeri (CONTOH).',
  },
  tanda_vital: { td: '120/80', nadi: '80', suhu: '36.9', rr: '18', spo2: '99', berat: '68', tinggi: '174' },
  pemeriksaan_mulut: {
    mukosa: 'Mukosa mulut normal (CONTOH).',
    gusi: 'Gusi di sekitar gigi 46 merah dan bengkak ringan (CONTOH).',
    gigi: 'Gigi 46 karies dalam, nyeri ketukan (CONTOH).',
    lainnya: '',
  },
  odontogram_ref: { ringkasan: 'Gigi 46 karies dalam; gigi 18 karies ringan (CONTOH).' },
  penunjang: { ringkasan: '' },
  rencana: {
    tatalaksana: 'Rencana penambalan gigi 46 pada kunjungan berikut; antibiotik 5 hari (CONTOH).',
    edukasi: 'Menyikat gigi dua kali sehari, menghindari makanan manis (CONTOH).',
    tindak_lanjut: 'Kontrol 5 hari (CONTOH).',
  },
}

const isiTelemedisin = {
  anamnesis: {
    keluhan_utama: 'Sakit kepala berdenyut sejak 2 hari (CONTOH).',
    riwayat_sekarang: 'Tidak disertai demam, mual, atau gangguan penglihatan (CONTOH).',
    riwayat_dahulu: 'Hipertensi, teratur minum obat (CONTOH).',
    alergi: 'Ada — dijelaskan di bawah',
    alergi_detail: 'Penisilin (CONTOH).',
    obat_dipakai: 'Kandesartan 8 mg setiap hari (CONTOH).',
  },
  tanda_vital: { td: '132/85', nadi: '78', suhu: '36.7', rr: '16', spo2: '98' },
  pemeriksaan: {
    kepala_leher: 'Tidak diperiksa langsung (konsultasi jarak jauh) (CONTOH).',
    dada: 'Tidak diperiksa langsung (konsultasi jarak jauh) (CONTOH).',
    perut: 'Tidak diperiksa langsung (konsultasi jarak jauh) (CONTOH).',
    ekstremitas: 'Tidak diperiksa langsung (konsultasi jarak jauh) (CONTOH).',
    lainnya: 'Pemeriksaan melalui video; pasien terlihat sadar, kooperatif (CONTOH).',
  },
  penunjang: { ringkasan: '' },
  rencana: {
    tatalaksana: 'Analgetik oral, istirahat cukup (CONTOH).',
    edukasi: 'Pantau tekanan darah harian; segera datang bila nyeri hebat / lemah anggota gerak (CONTOH).',
    tindak_lanjut: 'Kontrol tatap muka 1 minggu (CONTOH).',
  },
}

const isiRujukan = {
  anamnesis: {
    keluhan_utama: 'Batuk berdahak 3 minggu, berkurang lalu bertambah (CONTOH).',
    riwayat_sekarang: 'Batuk produktif, kadang demam malam (CONTOH).',
    riwayat_dahulu: 'PPOK sejak 2018 (CONTOH).',
    alergi: 'Tidak ada riwayat alergi',
    alergi_detail: '',
    obat_dipakai: 'Salbutamol inhaler sesuai kebutuhan (CONTOH).',
  },
  tanda_vital: { td: '126/82', nadi: '92', suhu: '37.6', rr: '24', spo2: '93', berat: '64', tinggi: '170' },
  pemeriksaan: {
    kepala_leher: 'Tidak ada limfadenopati (CONTOH).',
    dada: 'Wheezing dua sisi, ronki basah halus basal kanan (CONTOH).',
    perut: 'Normal (CONTOH).',
    ekstremitas: 'Sianosis tidak ada (CONTOH).',
    lainnya: '',
  },
  penunjang: { ringkasan: 'Rontgen dada (CONTOH): infiltrat basal kanan (CONTOH).' },
  rencana: {
    tatalaksana: 'Terapi symptomatic; kirim ke RS untuk evaluasi lanjut (CONTOH).',
    edukasi: 'Berhenti merokok, penggunaan inhaler yang benar (CONTOH).',
    tindak_lanjut: 'Rujukan RS Umum Contoh Kota (CONTOH).',
  },
}

async function upsertDokumen(encounterId: string, type: string, isi: object, versi: number) {
  await db.clinicalDocument.upsert({
    where: { id: `${encounterId}-${type}-v${versi}` },
    update: {},
    create: {
      id: `${encounterId}-${type}-v${versi}`,
      organizationId: ORG_ID,
      encounterId,
      type,
      profession: type === 'ODONTOGRAM' ? 'Dokter Gigi' : 'Dokter',
      version: versi,
      isCurrent: true,
      content: JSON.stringify(isi),
      createdByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })
}

async function kunjungan() {
  // ---------- E1: TERDAFTAR (antrean hari ini) ----------
  await db.encounter.upsert({
    where: { id: 'kunjungan-contoh-1' },
    update: {},
    create: {
      id: 'kunjungan-contoh-1',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-2',
      encounterNumber: 'KJG-0001',
      type: 'DATANG_SENDIRI',
      status: 'TERDAFTAR',
      chiefComplaint: 'Flu dan batuk 3 hari (CONTOH)',
      paymentMethod: 'UANG_SENDIRI',
      locationId: 'loc-contoh-utama',
      registeredAt: jam(2),
    },
  })

  // ---------- E2: DIPERIKSA (catatan versi 2, belum ada diagnosa) ----------
  await db.encounter.upsert({
    where: { id: 'kunjungan-contoh-2' },
    update: {},
    create: {
      id: 'kunjungan-contoh-2',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-1',
      encounterNumber: 'KJG-0002',
      type: 'DATANG_SENDIRI',
      status: 'DIPERIKSA',
      chiefComplaint: 'Kontrol rutin diabetes (CONTOH)',
      paymentMethod: 'UANG_SENDIRI',
      locationId: 'loc-contoh-utama',
      registeredAt: jam(3),
      startedAt: jam(2.5),
    },
  })
  await upsertDokumen('kunjungan-contoh-2', 'CATATAN_PEMERIKSAAN', isiUmumKurang, 1)
  await db.clinicalDocument.upsert({
    where: { id: 'kunjungan-contoh-2-CATATAN_PEMERIKSAAN-v2' },
    update: {},
    create: {
      id: 'kunjungan-contoh-2-CATATAN_PEMERIKSAAN-v2',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-2',
      type: 'CATATAN_PEMERIKSAAN',
      profession: 'Dokter',
      version: 2,
      isCurrent: true,
      content: JSON.stringify(isiUmumPenuh),
      createdByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })
  // v1 adalah versi lama yang sudah digantikan — bukan versi aktif.
  await db.clinicalDocument.update({
    where: { id: 'kunjungan-contoh-2-CATATAN_PEMERIKSAAN-v1' },
    data: { isCurrent: false },
  })

  // ---------- E3: TERKIRIM (penuh: diagnosa + tindakan + resep + consent + tagihan dibayar) ----------
  await db.encounter.upsert({
    where: { id: 'kunjungan-contoh-3' },
    update: {},
    create: {
      id: 'kunjungan-contoh-3',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-3',
      encounterNumber: 'KJG-0003',
      type: 'DATANG_SENDIRI',
      status: 'TERKIRIM',
      chiefComplaint: 'Luka jari tangan memar dan bernanah (CONTOH)',
      paymentMethod: 'UANG_SENDIRI',
      locationId: 'loc-contoh-tindakan',
      registeredAt: jam(30),
      startedAt: jam(29),
      finishedAt: jam(28),
      lockedAt: jam(27.5),
      lockedByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })
  await upsertDokumen('kunjungan-contoh-3', 'CATATAN_PEMERIKSAAN', isiUmumPenuh, 1)
  await db.encounterDiagnosis.upsert({
    where: { id: 'diagnosa-contoh-1' },
    update: {},
    create: {
      id: 'diagnosa-contoh-1',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-3',
      icd10Code: 'T78.4',
      display: 'Alergi, tidak spesifik',
      kind: 'UTAMA',
      note: 'Infeksi luka ringan (CONTOH)',
      createdByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })
  const consentTindakan = await db.consentRecord.upsert({
    where: { id: 'consent-contoh-1' },
    update: {},
    create: {
      id: 'consent-contoh-1',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-3',
      encounterId: 'kunjungan-contoh-3',
      type: 'TINDAKAN',
      agreedText:
        'Saya setuju dilakukan tindakan berikut: perawatan luka ( membersihkan dan membalut ). Saya telah menerima penjelasan mengenai manfaat, risiko, dan alternatif tindakan. (CONTOH)',
      agreedByName: 'Rina Marlina (CONTOH)',
      agreedByRole: 'PASIEN',
      method: 'ELEKTRONIK',
    },
  })
  await db.encounterProcedure.upsert({
    where: { id: 'tindakan-contoh-1' },
    update: {},
    create: {
      id: 'tindakan-contoh-1',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-3',
      icd9cmCode: '96.99',
      name: 'Perawatan luka sederhana (CONTOH)',
      note: 'Pembersihan dengan NaCl + povidon iodin, balut steril (CONTOH).',
      performerLabel: 'dr. Andi Wijaya (CONTOH)',
      consentId: consentTindakan.id,
    },
  })
  const resep3 = await db.prescription.upsert({
    where: { id: 'resep-contoh-3' },
    update: {},
    create: {
      id: 'resep-contoh-3',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-3',
      prescriptionNumber: 'RSP-0001',
      status: 'DISELESAIKAN',
      createdByLabel: 'dr. Andi Wijaya (CONTOH)',
      dispensedByLabel: 'Ni Made Ayu Lestari (CONTOH)',
      dispensedAt: jam(27),
    },
  })
  await db.prescriptionItem.upsert({
    where: { id: 'resep-contoh-3-item-1' },
    update: {},
    create: {
      id: 'resep-contoh-3-item-1',
      prescriptionId: resep3.id,
      kfaCode: 'KFA-CONTOH-0002',
      drugName: 'Amoksisilin',
      strength: '500 mg',
      form: 'kapsul',
      quantity: '15 kapsul',
      usage: '3x1 kapsul, habiskan 5 hari (CONTOH)',
    },
  })
  await db.prescriptionItem.upsert({
    where: { id: 'resep-contoh-3-item-2' },
    update: {},
    create: {
      id: 'resep-contoh-3-item-2',
      prescriptionId: resep3.id,
      kfaCode: 'KFA-CONTOH-0001',
      drugName: 'Paracetamol',
      strength: '500 mg',
      form: 'tablet',
      quantity: '10 tablet',
      usage: '3x1 tablet bila nyeri (CONTOH)',
    },
  })
  await db.invoice.upsert({
    where: { id: 'tagihan-contoh-3' },
    update: {},
    create: {
      id: 'tagihan-contoh-3',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-3',
      invoiceNumber: 'INV-0001',
      status: 'DIBAYAR',
      items: JSON.stringify([
        { deskripsi: 'Jasa pemeriksaan dokter (CONTOH)', qty: 1, harga: 75000 },
        { deskripsi: 'Perawatan luka sederhana (CONTOH)', qty: 1, harga: 50000 },
        { deskripsi: 'Obat resep (CONTOH)', qty: 1, harga: 42000 },
      ]),
      total: 167000,
      payerType: 'UANG_SENDIRI',
      paymentMethod: 'TUNAI',
      paidAt: jam(27),
      createdByLabel: 'Sari Dewi (CONTOH)',
    },
  })
  // Antrean SATUSEHAT mode SIMULASI — semua TERKIRIM dengan ID contoh.
  const kejadianE3: Array<[string, string]> = [
    ['PATIENT', 'pasien-contoh-3'],
    ['ENCOUNTER', 'kunjungan-contoh-3'],
    ['CONDITION', 'diagnosa-contoh-1'],
    ['PROCEDURE', 'tindakan-contoh-1'],
    ['MEDICATIONREQUEST', 'resep-contoh-3'],
    ['COMPOSITION', 'kunjungan-contoh-3'],
  ]
  let urut = 1
  for (const [tipe, ref] of kejadianE3) {
    await db.outboxEvent.upsert({
      where: { id: `outbox-contoh-3-${urut}` },
      update: {},
      create: {
        id: `outbox-contoh-3-${urut}`,
        organizationId: ORG_ID,
        encounterId: 'kunjungan-contoh-3',
        eventType: tipe,
        aggregateRef: ref,
        payload: JSON.stringify({ resourceType: tipe.replace('CONDITION', 'Condition').replace('PROCEDURE', 'Procedure'), contoh: true }),
        status: 'TERKIRIM',
        attempts: 1,
        fhirResourceType: tipe.charAt(0) + tipe.slice(1).toLowerCase(),
        fhirResourceId: `CONTOH-${tipe}-${urut}`,
        sentAt: jam(27),
      },
    })
    urut += 1
  }

  // ---------- E4: DIKUNCI (gigi, odontogram, resep menunggu farmasi, tagihan terbit) ----------
  await db.encounter.upsert({
    where: { id: 'kunjungan-contoh-4' },
    update: {},
    create: {
      id: 'kunjungan-contoh-4',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-4',
      encounterNumber: 'KJG-0004',
      type: 'DATANG_SENDIRI',
      status: 'DIKUNCI',
      chiefComplaint: 'Gigi geraham kanan bawah nyeri (CONTOH)',
      paymentMethod: 'UANG_SENDIRI',
      locationId: 'loc-contoh-utama',
      registeredAt: jam(6),
      startedAt: jam(5.5),
      finishedAt: jam(5),
      lockedAt: jam(4.5),
      lockedByLabel: 'drg. Budi Santoso (CONTOH)',
    },
  })
  await upsertDokumen('kunjungan-contoh-4', 'CATATAN_PEMERIKSAAN', isiGigi, 1)
  await db.clinicalDocument.upsert({
    where: { id: 'kunjungan-contoh-4-ODONTOGRAM-v1' },
    update: {},
    create: {
      id: 'kunjungan-contoh-4-ODONTOGRAM-v1',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-4',
      type: 'ODONTOGRAM',
      profession: 'Dokter Gigi',
      version: 1,
      isCurrent: true,
      content: JSON.stringify({ '46': 'KARIES', '18': 'KARIES', '26': 'RESTORASI', '36': 'HILANG', '37': 'DICABUT' }),
      createdByLabel: 'drg. Budi Santoso (CONTOH)',
    },
  })
  await db.encounterDiagnosis.upsert({
    where: { id: 'diagnosa-contoh-4' },
    update: {},
    create: {
      id: 'diagnosa-contoh-4',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-4',
      icd10Code: 'K02.9',
      display: 'Karies gigi, tidak spesifik',
      kind: 'UTAMA',
      createdByLabel: 'drg. Budi Santoso (CONTOH)',
    },
  })
  const resep4 = await db.prescription.upsert({
    where: { id: 'resep-contoh-4' },
    update: {},
    create: {
      id: 'resep-contoh-4',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-4',
      prescriptionNumber: 'RSP-0002',
      status: 'DIBUAT',
      createdByLabel: 'drg. Budi Santoso (CONTOH)',
    },
  })
  await db.prescriptionItem.upsert({
    where: { id: 'resep-contoh-4-item-1' },
    update: {},
    create: {
      id: 'resep-contoh-4-item-1',
      prescriptionId: resep4.id,
      kfaCode: 'KFA-CONTOH-0003',
      drugName: 'Sefadroksil',
      strength: '500 mg',
      form: 'kapsul',
      quantity: '12 kapsul',
      usage: '3x1 kapsul, habiskan 4 hari (CONTOH)',
    },
  })
  await db.invoice.upsert({
    where: { id: 'tagihan-contoh-4' },
    update: {},
    create: {
      id: 'tagihan-contoh-4',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-4',
      invoiceNumber: 'INV-0002',
      status: 'TERBIT',
      items: JSON.stringify([
        { deskripsi: 'Jasa pemeriksaan dokter gigi (CONTOH)', qty: 1, harga: 90000 },
        { deskripsi: 'Obat resep (CONTOH)', qty: 1, harga: 38000 },
      ]),
      total: 128000,
      payerType: 'UANG_SENDIRI',
      createdByLabel: 'Sari Dewi (CONTOH)',
    },
  })

  // ---------- E5: SELESAI (kurang lengkap — demo penghenti penguncian) ----------
  await db.encounter.upsert({
    where: { id: 'kunjungan-contoh-5' },
    update: {},
    create: {
      id: 'kunjungan-contoh-5',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-5',
      encounterNumber: 'KJG-0005',
      type: 'DATANG_SENDIRI',
      status: 'SELESAI',
      chiefComplaint: 'Pusing, kontrol hipertensi (CONTOH)',
      paymentMethod: 'UANG_SENDIRI',
      locationId: 'loc-contoh-utama',
      registeredAt: jam(4),
      startedAt: jam(3.5),
      finishedAt: jam(3),
    },
  })
  await upsertDokumen('kunjungan-contoh-5', 'CATATAN_PEMERIKSAAN', isiUmumKurang, 1)
  await db.encounterDiagnosis.upsert({
    where: { id: 'diagnosa-contoh-5' },
    update: {},
    create: {
      id: 'diagnosa-contoh-5',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-5',
      icd10Code: 'I10',
      display: 'Hipertensi esensial (primer)',
      kind: 'UTAMA',
      createdByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })

  // ---------- E6: GAGAL_KIRIM (satu kejadian gagal → demo coba ulang) + rujukan ----------
  await db.encounter.upsert({
    where: { id: 'kunjungan-contoh-6' },
    update: {},
    create: {
      id: 'kunjungan-contoh-6',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-6',
      encounterNumber: 'KJG-0006',
      type: 'KUNJUNGAN_RUMAH',
      status: 'GAGAL_KIRIM',
      chiefComplaint: 'Batuk berdahak 3 minggu, PPOK (CONTOH)',
      paymentMethod: 'UANG_SENDIRI',
      locationId: 'loc-contoh-utama',
      registeredAt: jam(74),
      startedAt: jam(73),
      finishedAt: jam(72),
      lockedAt: jam(71),
      lockedByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })
  await upsertDokumen('kunjungan-contoh-6', 'CATATAN_PEMERIKSAAN', isiRujukan, 1)
  await db.encounterDiagnosis.upsert({
    where: { id: 'diagnosa-contoh-6' },
    update: {},
    create: {
      id: 'diagnosa-contoh-6',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-6',
      icd10Code: 'J44.9',
      display: 'Penyakit paru obstruktif kronik, tidak spesifik',
      kind: 'UTAMA',
      createdByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })
  await db.consentRecord.upsert({
    where: { id: 'consent-contoh-6' },
    update: {},
    create: {
      id: 'consent-contoh-6',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-6',
      encounterId: 'kunjungan-contoh-6',
      type: 'PERSETUJUAN_UMUM',
      agreedText:
        'Saya setuju data kesehatan saya diolah untuk pelayanan dan pengajuan data ke sistem kesehatan sesuai peraturan. (CONTOH)',
      agreedByName: 'Yusuf Hidayat (CONTOH)',
      agreedByRole: 'PASIEN',
      method: 'ELEKTRONIK',
    },
  })
  await db.referral.upsert({
    where: { id: 'rujukan-contoh-6' },
    update: {},
    create: {
      id: 'rujukan-contoh-6',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-6',
      letterNumber: 'RUJ-0001',
      destination: 'RS Umum Contoh Kota (CONTOH)',
      reason: 'Evaluasi infiltrat pada rontgen dada dan perencanaan terapi lanjutan PPOK (CONTOH).',
      notes: 'Saturasi 93% dengan udara ruangan (CONTOH).',
      createdByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })
  await db.outboxEvent.upsert({
    where: { id: 'outbox-contoh-6-1' },
    update: {},
    create: {
      id: 'outbox-contoh-6-1',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-6',
      eventType: 'PATIENT',
      aggregateRef: 'pasien-contoh-6',
      payload: JSON.stringify({ resourceType: 'Patient', contoh: true }),
      status: 'TERKIRIM',
      attempts: 1,
      fhirResourceType: 'Patient',
      fhirResourceId: 'CONTOH-Patient-6',
      sentAt: jam(70),
    },
  })
  await db.outboxEvent.upsert({
    where: { id: 'outbox-contoh-6-2' },
    update: {},
    create: {
      id: 'outbox-contoh-6-2',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-6',
      eventType: 'ENCOUNTER',
      aggregateRef: 'kunjungan-contoh-6',
      payload: JSON.stringify({ resourceType: 'Encounter', contoh: true }),
      status: 'GAGAL_KIRIM',
      attempts: 2,
      lastError: 'Contoh kegagalan jaringan — tekan "Coba ulang" untuk memproses ulang (mode SIMULASI)',
    },
  })

  // ---------- E7: TELEMEDISIN TERKIRIM + persetujuan telemedisin ----------
  await db.encounter.upsert({
    where: { id: 'kunjungan-contoh-7' },
    update: {},
    create: {
      id: 'kunjungan-contoh-7',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-5',
      encounterNumber: 'KJG-0007',
      type: 'TELEMEDISIN',
      status: 'TERKIRIM',
      chiefComplaint: 'Sakit kepala berdenyut (konsultasi jarak jauh) (CONTOH)',
      paymentMethod: 'UANG_SENDIRI',
      registeredAt: jam(50),
      startedAt: jam(49),
      finishedAt: jam(48.5),
      lockedAt: jam(48),
      lockedByLabel: 'dr. Andi Wijaya (CONTOH)',
      telemedicineNote: 'Video konsultasi 12 menit (CONTOH)',
    },
  })
  await upsertDokumen('kunjungan-contoh-7', 'CATATAN_PEMERIKSAAN', isiTelemedisin, 1)
  await db.encounterDiagnosis.upsert({
    where: { id: 'diagnosa-contoh-7' },
    update: {},
    create: {
      id: 'diagnosa-contoh-7',
      organizationId: ORG_ID,
      encounterId: 'kunjungan-contoh-7',
      icd10Code: 'R51',
      display: 'Sakit kepala',
      kind: 'UTAMA',
      createdByLabel: 'dr. Andi Wijaya (CONTOH)',
    },
  })
  await db.consentRecord.upsert({
    where: { id: 'consent-contoh-7' },
    update: {},
    create: {
      id: 'consent-contoh-7',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-5',
      encounterId: 'kunjungan-contoh-7',
      type: 'TELEMEDISIN',
      agreedText:
        'Saya setuju menerima layanan konsultasi jarak jauh (telemedisin) pada praktik ini. Saya memahami keterbatasan pemeriksaan jarak jauh dan akan datang langsung bila diminta oleh tenaga kesehatan. (CONTOH)',
      agreedByName: 'Kartika Wulan (CONTOH)',
      agreedByRole: 'PASIEN',
      method: 'ELEKTRONIK',
    },
  })
}

async function konfigurasiDanLainnya() {
  // Konfigurasi SATUSEHAT: mode SIMULASI aktif agar antrean bisa dicoba.
  await db.satusehatConfig.upsert({
    where: { organizationId: ORG_ID },
    update: {},
    create: {
      organizationId: ORG_ID,
      mode: 'SIMULASI',
      enabled: true,
      lastProcessedAt: jam(27),
    },
  })

  // Portal pasien: kode demo 482913 (dihash); ditampilkan pada halaman masuk portal.
  await db.portalAccess.upsert({
    where: { id: 'portal-contoh-1' },
    update: { codeHash: hashKode(KODE_PORTAL_DEMO), isActive: true },
    create: {
      id: 'portal-contoh-1',
      organizationId: ORG_ID,
      patientId: 'pasien-contoh-1',
      codeHash: hashKode(KODE_PORTAL_DEMO),
      isActive: true,
    },
  })

  // Changelog rilis 1.0.0 (Fase 1–8).
  await db.releaseLog.upsert({
    where: { id: 'release-1-0-0' },
    update: {},
    create: {
      id: 'release-1-0-0',
      phase: 'Fase 1–8 — RME lengkap (lingkungan contoh)',
      version: '1.0.0',
      features: JSON.stringify([
        'Fase 1 — Registrasi pasien (NIK opsional, anti-duplikat, nomor RM otomatis) dan kunjungan (datang sendiri / perjanjian / telemedisin / kunjungan rumah) dengan alur status terdaftar → diperiksa → selesai → dikunci → terkirim/gagal kirim',
        'Fase 2 — Catatan klinis berversi per profesi; tanpa jalur hapus; kunci kunjungan dengan cek kelengkapan field wajib rawat jalan (PMK 24/2022); buka kunci hanya Penanggung Jawab dengan alasan dan audit',
        'Fase 3 — Diagnosa ICD-10 (wajib berkode), tindakan ICD-9-CM opsional + persetujuan tindakan, resep dengan kode KFA, terminologi kustom per praktik',
        'Fase 4 — Resume kunjungan otomatis dari data terkunci + salinan cetak untuk pasien (resume, resep, rujukan)',
        'Fase 5 — Adapter SATUSEHAT pola outbox: kunjungan terkunci masuk antrean, mapper FHIR R4, pekerja mode SIMULASI/SANDBOX, riwayat percobaan, coba ulang, tanpa penghapusan data lokal',
        'Fase 6 — Portal pasien dengan kode akses 6 digit (disimpan ter-hash) + verifikasi tanggal lahir; persetujuan (consent) tersimpan sebagai snapshot teks',
        'Fase 7 — Dasbor mutu kelengkapan, informasi retensi 25 tahun, odontogram 32 gigi, templat per profesi (dokter, gigi, perawat/bidan, profesi lain)',
        'Fase 8 — Tagihan ringan dari kunjungan terkunci, status pembayaran, ekspor CSV; surat rujukan keluar bernomor otomatis',
      ]),
      regulatoryImpact:
        'Menyediakan fungsi minimum penyelenggaraan RME rawat jalan sesuai PMK 24/2022 pada lingkungan contoh: identitas pasien & pembayar, waktu buka-tutup, anamnesis (termasuk alergi), pemeriksaan, penunjang, diagnosa, tatalaksana, edukasi, identitas PPA, dan jejak audit. Belum ada klaim kepatuhan produksi; diperlukan peninjauan hukum, uji keamanan independen, dan registrasi PSE oleh penyelenggara.',
      migrationNote: 'Menambah skema klinis di atas skema Fase 0. Tidak memigrasikan data dari sistem lain.',
      deferred: JSON.stringify([
        'Verifikasi dua langkah (2FA) untuk peran klinis — struktur akun sudah siap',
        'Kode KFA resmi (di demo memakai kode CONTOH); pengisian daftar resmi lewat modul Terminologi',
        'Integrasi BPJS Kesehatan / SISRUTE (antarmuka saja, tanpa integrasi palsu)',
        'Panggilan video telemedisin bawaan (kanal eksternal milik praktik)',
        'Tanda tangan elektronik tersertifikasi (TTE) — kunjungan masih dikunci dengan audit + penguncian',
        'Enkripsi kolom saat tersimpan dan dokumentasi RPO/RTO produksi',
        'Pendaftaran PSE dan sertifikasi — tanggung jawab penyelenggara, bukan klaim aplikasi',
      ]),
    },
  })
}

async function main() {
  console.log('Memulai seed Fase 1–8 e-SIMANTRI (data CONTOH)…')
  await terminologi()
  await pasien()
  await kunjungan()
  await konfigurasiDanLainnya()
  console.log('Seed Fase 1–8 selesai.')
  console.log('Kode portal demo (hash tersimpan):', KODE_PORTAL_DEMO)
}

main()
  .catch((e) => {
    console.error('Seed gagal:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
