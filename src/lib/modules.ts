// ============================================================
// Peta modul e-SIMANTRI (kontrak arsitektur)
// Setiap modul punya batas tegas: skema data + antarmuka sendiri.
// Status dihitung dari fase yang sudah diluncurkan.
// ============================================================

export type ModuleStatus = 'AKTIF' | 'DIRENCANAKAN'

export interface AppModule {
  id: string
  name: string
  description: string
  phase: number
  status: ModuleStatus
}

export const MODULE_REGISTRY: AppModule[] = [
  {
    id: 'identity_access',
    name: 'identity_access',
    description:
      'Pengguna, sesi, peran, tenant. Fondasi kontrol akses: organisasi + peran + hubungan dengan kunjungan + kewenangan profesi.',
    phase: 0,
    status: 'AKTIF',
  },
  {
    id: 'audit',
    name: 'audit',
    description:
      'Jejak audit append-only: siapa, peran, kapan, perangkat, objek, aksi, alasan bila akses tidak rutin.',
    phase: 0,
    status: 'AKTIF',
  },
  {
    id: 'registry',
    name: 'registry',
    description:
      'Pasien dan identitas: NIK, nomor rekam medis internal, IHS bila ada, pencegahan duplikat, alur pasien tanpa NIK.',
    phase: 1,
    status: 'AKTIF',
  },
  {
    id: 'encounter',
    name: 'encounter',
    description:
      'Kunjungan dan status: terdaftar → diperiksa → selesai → dikunci → terkirim/gagal kirim. Termasuk telemedisin dan kunjungan rumah.',
    phase: 1,
    status: 'AKTIF',
  },
  {
    id: 'clinical_document',
    name: 'clinical_document',
    description:
      'Templat per profesi, dokumen berversi, penguncian catatan, larangan hapus klinis, dasbor kelengkapan field wajib.',
    phase: 2,
    status: 'AKTIF',
  },
  {
    id: 'terminology',
    name: 'terminology',
    description:
      'ICD-10, ICD-9-CM, KFA, dan kode lain yang bisa ditambah. Pencarian dan validasi sebelum kirim.',
    phase: 3,
    status: 'AKTIF',
  },
  {
    id: 'medication_procedure',
    name: 'medication & procedure',
    description:
      'Resep (obat, kekuatan, sediaan, jumlah, aturan pakai, penulis) dan tindakan, menempel pada kunjungan terkunci.',
    phase: 3,
    status: 'AKTIF',
  },
  {
    id: 'consent',
    name: 'consent',
    description:
      'Persetujuan umum perawatan data dan persetujuan tindakan, tersimpan bersama versi teks yang disetujui pasien.',
    phase: 6,
    status: 'AKTIF',
  },
  {
    id: 'quality_retention',
    name: 'quality_retention',
    description:
      'Kelengkapan berkas sebelum kunci, laporan bulanan, penghitungan usia berkas sejak kunjungan terakhir (retensi ≥ 25 tahun).',
    phase: 7,
    status: 'AKTIF',
  },
  {
    id: 'billing_claim',
    name: 'billing_claim',
    description:
      'Tarif sederhana, metode bayar, dan data klaim yang diperlukan. Tipis dulu; bukan akuntansi penuh.',
    phase: 8,
    status: 'AKTIF',
  },
  {
    id: 'integration_satusehat',
    name: 'integration_satusehat',
    description:
      'Adapter + outbox + worker mapper FHIR R4. Inti RME tidak pernah memanggil API SATUSEHAT langsung dari layar.',
    phase: 5,
    status: 'AKTIF',
  },
  {
    id: 'patient_portal',
    name: 'patient_portal',
    description:
      'Akun pasien terbatas: jadwal, ringkasan terkunci, permintaan salinan, persetujuan, riwayat akses berkasnya.',
    phase: 6,
    status: 'AKTIF',
  },
  {
    id: 'referral',
    name: 'referral',
    description:
      'Surat rujukan keluar bernomor otomatis dari kunjungan selesai/terkunci, lengkap dengan cetak salinan dan jejak audit.',
    phase: 8,
    status: 'AKTIF',
  },
]

export interface PhasePlan {
  phase: number
  title: string
  scope: string[]
}

export const PHASE_PLAN: PhasePlan[] = [
  {
    phase: 0,
    title: 'Fondasi',
    scope: [
      'Kerangka aplikasi, tenant, masuk akun, peran',
      'Jejak audit (kosong, siap terisi)',
      'Profil tempat praktik',
      'Data contoh fiktif satu praktik',
    ],
  },
  {
    phase: 1,
    title: 'Registrasi dan kunjungan',
    scope: ['Pasien', 'Antrean hari ini', 'Buka kunjungan, status'],
  },
  {
    phase: 2,
    title: 'Catatan klinis dokter umum',
    scope: [
      'Form wajib sesuai PMK 24/2022',
      'Versi dan kunci catatan',
      'Larangan hapus klinis',
      'Dasbor kelengkapan',
    ],
  },
  {
    phase: 3,
    title: 'Diagnosis, tindakan, resep',
    scope: ['ICD-10', 'ICD-9-CM', 'KFA', 'Resep & tindakan pada kunjungan terkunci'],
  },
  {
    phase: 4,
    title: 'Resume dan salinan pasien',
    scope: ['Ringkasan terstruktur', 'Unduh salinan', 'Jejak siapa mencetak'],
  },
  {
    phase: 5,
    title: 'Adapter SATUSEHAT',
    scope: [
      'Mapper FHIR, outbox, antrean sandbox',
      'Kredensial per praktik',
      'Status terkirim / gagal',
    ],
  },
  {
    phase: 6,
    title: 'Portal pasien dan consent',
    scope: ['Akun pasien terbatas', 'Persetujuan', 'Riwayat akses'],
  },
  {
    phase: 7,
    title: 'Mutu, retensi, telemedisin, templat profesi lain',
    scope: ['Satu profesi baru setiap giliran', 'Odontogram', 'Mutu & retensi'],
  },
  {
    phase: 8,
    title: 'Klaim dan rujukan',
    scope: ['Antarmuka klaim', 'SISRUTE / rujukan', 'Hanya setelah data klinis stabil'],
  },
]
