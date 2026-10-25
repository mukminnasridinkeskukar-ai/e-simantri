// ============================================================
// e-SIMANTRI — Modul identity_access: Peran dan Hak Akses
// Fase 0 (Fondasi)
//
// Prinsip (bagian 4 master prompt):
// - Peran bawaan: hak bisa DIPERSEMPIT per praktik, tidak boleh
//   diperluas diam-diam melebihi kewenangan hukum.
// - Izin bersifat: organisasi + peran + hubungan dengan kunjungan
//   + kewenangan profesi (dipakai penuh mulai Fase 1-2).
// - Kunci-nilai peran disimpan sebagai String di database dan
//   divalidasi lewat konstanta di berkas ini.
// File ini bebas dari dependensi server agar aman diimpor klien.
// ============================================================

export const ROLE_KEYS = [
  'PENANGGUNG_JAWAB',
  'PPA',
  'PPA_PENDAMPING',
  'PENDAFTARAN',
  'REKAM_MEDIS',
  'KASIR',
  'PASIEN',
  'ADMIN_TEKNIS',
] as const

export type RoleKey = (typeof ROLE_KEYS)[number]

export const ROLE_LABELS: Record<RoleKey, string> = {
  PENANGGUNG_JAWAB: 'Penanggung Jawab Praktik',
  PPA: 'Profesional Pemberi Asuhan (PPA)',
  PPA_PENDAMPING: 'PPA Pendamping',
  PENDAFTARAN: 'Petugas Pendaftaran',
  REKAM_MEDIS: 'Petugas Rekam Medis',
  KASIR: 'Kasir / Klaim',
  PASIEN: 'Pasien',
  ADMIN_TEKNIS: 'Admin Teknis',
}

export const ROLE_SHORT: Record<RoleKey, string> = {
  PENANGGUNG_JAWAB: 'Penanggung Jawab',
  PPA: 'PPA',
  PPA_PENDAMPING: 'PPA Pendamping',
  PENDAFTARAN: 'Pendaftaran',
  REKAM_MEDIS: 'Rekam Medis',
  KASIR: 'Kasir',
  PASIEN: 'Pasien',
  ADMIN_TEKNIS: 'Admin Teknis',
}

export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  PENANGGUNG_JAWAB:
    'Mengelola tempat praktik, pengguna, dan kebijakan, serta melihat dasbor mutu. Tidak otomatis boleh membaca seluruh isi klinis pengguna lain kecuali tugas pengawasan diaktifkan dan diaudit.',
  PPA:
    'Dokter, dokter gigi, atau tenaga kesehatan sesuai profesi. Membuat dan mengunci catatan pada kunjungan yang menjadi tanggung jawabnya, memakai templat profesinya.',
  PPA_PENDAMPING:
    'Misalnya perawat atau bidan pendamping yang mengisi asesmen awal, tanda vital, dan bagian asuhan dalam batas kewenangannya, tanpa mengubah diagnosis medis yang bukan wewenangnya.',
  PENDAFTARAN:
    'Mengelola identitas, jadwal, kunjungan, dan penjamin. Tidak melihat isi diagnosis, resep, dan catatan pemeriksaan, kecuali lapangan yang memang diizinkan kebijakan praktik.',
  REKAM_MEDIS:
    'Mengurus kelengkapan berkas, bantuan koding, retensi, ekspor, dan mutu. Akses isi hanya sebatas tugas pengelolaan dan seluruhnya diaudit.',
  KASIR:
    'Mengelola tarif, pembayaran, penjamin, dan data klaim yang diperlukan. Tidak membuka narasi pemeriksaan lengkap.',
  PASIEN:
    'Melihat jadwalnya, ringkasan yang sudah dikunci, permintaan salinan, persetujuan, dan riwayat siapa yang mengakses berkasnya di praktik ini. Portal pasien hadir pada Fase 6.',
  ADMIN_TEKNIS:
    'Mengonfigurasi sistem dan memantau status antrean integrasi. Tidak memiliki akses baca isi klinis secara bawaan.',
}

// ------------------------------------------------------------
// Kunci izin Fase 0-3. Kunci Fase 0 (administratif), Fase 1-2
// (pasien, kunjungan, catatan klinis, kelengkapan), dan Fase 3
// (terminologi, kodifikasi). Kunci Fase 4+ (ringkasan, salinan,
// SATUSEHAT, klaim) akan ditambahkan pada fase-nya.
// ------------------------------------------------------------
export const PERMISSION_KEYS = [
  // Fase 0 — administratif
  'beranda.lihat',
  'praktik.profil.lihat',
  'praktik.profil.ubah',
  'pengguna.lihat',
  'pengguna.kelola',
  'peran.lihat',
  'audit.lihat',
  'akun.kelola',
  // Fase 1 — registrasi & kunjungan
  'pasien.lihat',
  'pasien.kelola',
  'kunjungan.lihat',
  'kunjungan.buka',
  'kunjungan.tutup',
  // Fase 2 — catatan klinis & kelengkapan
  'catatan.klinis.lihat',
  'catatan.klinis.kelola',
  'catatan.klinis.kunci',
  'catatan.klinis.revisi',
  'kelengkapan.dasbor.lihat',
  // Fase 3 — terminologi & kodifikasi
  'terminologi.cari',   // mencari katalog ICD-10/ICD-9-CM/KFA (referensi global)
  'kodifikasi.kelola',  // mengatur kode & resep pada draf catatan milik sendiri
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

const ALL_ROLES: readonly RoleKey[] = ROLE_KEYS

// Matriks izin Fase 0-3.
// Prinsip kunci (master prompt):
// - Penanggung Jawab TIDAK otomatis membaca isi klinis pengguna
//   lain; ia melihat metadata kunjungan dan dasbor kelengkapan.
//   Kode diagnosis/resep adalah ISI KLINIS — PJ tidak mencarinya
//   dan tidak mengelolanya.
// - Pendaftaran tidak melihat isi catatan klinis sama sekali.
// - Membuka isi catatan oleh pihak bukan penulis selalu diaudit.
export const ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  PENANGGUNG_JAWAB: [
    'beranda.lihat',
    'praktik.profil.lihat',
    'praktik.profil.ubah',
    'pengguna.lihat',
    'pengguna.kelola',
    'peran.lihat',
    'audit.lihat',
    'akun.kelola',
    'pasien.lihat',
    'kunjungan.lihat',
    'kelengkapan.dasbor.lihat',
  ],
  PPA: [
    'beranda.lihat',
    'praktik.profil.lihat',
    'peran.lihat',
    'akun.kelola',
    'pasien.lihat',
    'pasien.kelola',
    'kunjungan.lihat',
    'kunjungan.buka',
    'catatan.klinis.lihat',
    'catatan.klinis.kelola',
    'catatan.klinis.kunci',
    'catatan.klinis.revisi',
    'terminologi.cari',
    'kodifikasi.kelola',
  ],
  PPA_PENDAMPING: [
    'beranda.lihat',
    'praktik.profil.lihat',
    'peran.lihat',
    'akun.kelola',
    'pasien.lihat',
    'kunjungan.lihat',
    'catatan.klinis.lihat', // buka isi selalu diaudit; templat asuhan pendamping menyusul Fase 7
    'terminologi.cari', // referensi katalog boleh dibaca; mengelola kode tetap milik PPA penulis
  ],
  PENDAFTARAN: [
    'beranda.lihat',
    'praktik.profil.lihat',
    'peran.lihat',
    'akun.kelola',
    'pasien.lihat',
    'pasien.kelola',
    'kunjungan.lihat',
    'kunjungan.buka',
    'kunjungan.tutup',
  ],
  REKAM_MEDIS: [
    'beranda.lihat',
    'praktik.profil.lihat',
    'peran.lihat',
    'akun.kelola',
    'pasien.lihat',
    'kunjungan.lihat',
    'catatan.klinis.lihat', // untuk tugas kelengkapan/koding — seluruhnya diaudit
    'kelengkapan.dasbor.lihat',
    'terminologi.cari', // bantuan koding: mencari kode ICD-10/ICD-9-CM
  ],
  KASIR: [
    'beranda.lihat',
    'praktik.profil.lihat',
    'peran.lihat',
    'akun.kelola',
  ],
  PASIEN: ['beranda.lihat', 'akun.kelola'],
  ADMIN_TEKNIS: [
    'beranda.lihat',
    'praktik.profil.lihat',
    'praktik.profil.ubah',
    'pengguna.lihat',
    'pengguna.kelola',
    'peran.lihat',
    'audit.lihat',
    'akun.kelola',
  ],
}

export function roleHasPermission(role: RoleKey, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

// ------------------------------------------------------------
// Aturan penugasan peran.
// - Hanya Penanggung Jawab boleh menetapkan peran klinis (PPA,
//   PPA Pendamping) dan peran Penanggung Jawab lain.
// - Admin Teknis boleh mengurus peran operasional saja, agar
//   tidak dapat memperluas akses klinis diam-diam.
// ------------------------------------------------------------
const CLINICAL_GRANT_ROLES: RoleKey[] = ['PENANGGUNG_JAWAB', 'PPA', 'PPA_PENDAMPING']

export function canGrantRole(granterRole: RoleKey, targetRole: RoleKey): boolean {
  if (granterRole === 'PENANGGUNG_JAWAB') return true
  if (granterRole === 'ADMIN_TEKNIS') return !CLINICAL_GRANT_ROLES.includes(targetRole)
  return false
}

export const GRANTABLE_ROLES: Partial<Record<RoleKey, readonly RoleKey[]>> = {
  PENANGGUNG_JAWAB: ROLE_KEYS,
  ADMIN_TEKNIS: ROLE_KEYS.filter((r) => !CLINICAL_GRANT_ROLES.includes(r)),
}

// Peran klinis wajib melengkapi profesi dan STR/SIP agar sistem
// tidak membiarkan penugasan di luar kewenangan profesi.
export function requiresClinicalCredential(role: RoleKey): boolean {
  return role === 'PPA' || role === 'PPA_PENDAMPING'
}

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value)
}

// Label aksi audit untuk tampilan konsisten (Bahasa Indonesia)
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  MASUK_BERHASIL: 'Masuk berhasil',
  MASUK_GAGAL: 'Masuk gagal',
  MASUK_TAHAP_AWAL: 'Masuk tahap awal (menunggu 2FA)',
  VERIFIKASI_2FA_BERHASIL: 'Verifikasi 2FA berhasil',
  VERIFIKASI_2FA_GAGAL: 'Verifikasi 2FA gagal',
  KELUAR: 'Keluar',
  SESI_KEDALUWARSA: 'Sesi kedaluwarsa',
  SESI_DICABUT: 'Sesi dicabut',
  PILIH_PRAKTIK: 'Pilih praktik aktif',
  GANTI_PRAKTIK: 'Ganti praktik aktif',
  PROFIL_PRAKTIK_DIUBAH: 'Profil praktik diubah',
  PENGGUNA_DITAMBAHKAN: 'Pengguna ditambahkan',
  PENGGUNA_DIAKTIFKAN: 'Pengguna diaktifkan',
  PENGGUNA_DINONAKTIFKAN: 'Pengguna dinonaktifkan',
  PERAN_KEANGGOTAAN_DIUBAH: 'Peran keanggotaan diubah',
  KATA_SANDI_DIUBAH: 'Kata sandi diubah',
  AKUN_2FA_SETUP_DIMULAI: 'Setup 2FA dimulai',
  AKUN_2FA_DIAKTIFKAN: '2FA diaktifkan',
  AKUN_2FA_DIMATIKAN: '2FA dimatikan',
  AKSES_DITOLAK: 'Akses ditolak',
  DATA_DILIHAT: 'Data dilihat',
  INISIALISASI: 'Inisialisasi sistem',
  // Fase 1-2
  PASIEN_DIDAFTARKAN: 'Pasien didaftarkan',
  DATA_PASIEN_DIUBAH: 'Data pasien diubah',
  KUNJUNGAN_DIBUKA: 'Kunjungan dibuka',
  KUNJUNGAN_DITUTUP: 'Kunjungan ditutup',
  CATATAN_DIBUAT: 'Catatan klinis dibuat',
  CATATAN_DISEMPAN: 'Catatan klinis disimpan',
  CATATAN_DIKUNCI: 'Catatan klinis dikunci',
  CATATAN_DIAMANDEMEN: 'Catatan klinis diamandemen',
  CATATAN_DILIHAT: 'Isi catatan klinis dilihat',
  VERSI_CATATAN_DILIHAT: 'Versi catatan klinis dilihat',
  // Fase 3
  KODIFIKASI_DISEMPAN: 'Kodifikasi catatan disimpan',
  RESEP_DIBUAT: 'Resep terbit',
  RESEP_DISEMPAN: 'Resep disimpan',
  RESEP_DIBATALKAN: 'Resep dibatalkan',
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

// Jenis tempat praktik mandiri (profil fasilitas)
export const PRACTICE_TYPE_KEYS = [
  'PRAKTIK_DOKTER',
  'PRAKTIK_DOKTER_GIGI',
  'PRAKTIK_BIDAN',
  'PRAKTIK_PERAWAT',
  'PRAKTIK_APOTEKER',
  'PRAKTIK_AHLI_GIZI',
  'PRAKTIK_FISIOTERAPI',
  'PRAKTIK_LAINNYA',
] as const

export const PRACTICE_TYPE_LABELS: Record<string, string> = {
  PRAKTIK_DOKTER: 'Praktik Dokter',
  PRAKTIK_DOKTER_GIGI: 'Praktik Dokter Gigi',
  PRAKTIK_BIDAN: 'Praktik Bidan',
  PRAKTIK_PERAWAT: 'Praktik Perawat',
  PRAKTIK_APOTEKER: 'Praktik Apoteker',
  PRAKTIK_AHLI_GIZI: 'Praktik Ahli Gizi',
  PRAKTIK_FISIOTERAPI: 'Praktik Fisioterapi',
  PRAKTIK_LAINNYA: 'Praktik Lainnya',
}
