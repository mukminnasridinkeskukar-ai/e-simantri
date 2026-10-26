// ============================================================
// MODUL: identity_access — definisi peran dan matriks izin Fase 0
//
// Prinsip: izin bersifat (organisasi + peran + hubungan dengan kunjungan +
// kewenangan profesi). Pada Fase 0 belum ada data klinis, jadi matriks ini
// hanya mengatur halaman administratif. Peran TIDAK boleh diperluas diam-diam;
// setiap perubahan matriks wajib tercatat pada changelog rilis.
// ============================================================

export const ROLES = [
  'PENANGGUNG_JAWAB',
  'PPA',
  'PPA_PENDAMPING',
  'PENDAFTARAN',
  'REKAM_MEDIS',
  'KASIR',
  'PASIEN',
  'ADMIN_TEKNIS',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  PENANGGUNG_JAWAB: 'Penanggung Jawab Praktik',
  PPA: 'Profesional Pemberi Asuhan (PPA)',
  PPA_PENDAMPING: 'PPA Pendamping',
  PENDAFTARAN: 'Petugas Pendaftaran',
  REKAM_MEDIS: 'Petugas Rekam Medis',
  KASIR: 'Kasir / Klaim',
  PASIEN: 'Pasien',
  ADMIN_TEKNIS: 'Admin Teknis',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  PENANGGUNG_JAWAB:
    'Mengelola tempat praktik, pengguna, dan kebijakan. Tidak otomatis membaca isi klinis pengguna lain; tugas pengawasan bila diaktifkan dan diaudit.',
  PPA:
    'Dokter, dokter gigi, atau nakes sesuai profesi. Membuat dan mengunci catatan pada kunjungan yang menjadi tanggungannya sesuai templat profesinya.',
  PPA_PENDAMPING:
    'Perawat/bidan yang mengisi asesmen awal dan tanda vital dalam batas kewenangan, tanpa mengubah diagnosis medis yang bukan wewenangnya.',
  PENDAFTARAN:
    'Identitas, jadwal, kunjungan, penjamin. Tidak melihat isi diagnosis, resep, dan catatan pemeriksaan.',
  REKAM_MEDIS:
    'Kelengkapan berkas, bantuan koding, retensi, ekspor, mutu. Akses isi hanya sebatas tugas pengelolaan dan seluruhnya diaudit.',
  KASIR:
    'Tarif, pembayaran, penjamin, dan data klaim yang diperlukan. Tidak membuka narasi pemeriksaan lengkap.',
  PASIEN:
    'Melihat jadwal, ringkasan yang sudah dikunci, permintaan salinan, persetujuan, dan riwayat akses berkasnya di praktik ini.',
  ADMIN_TEKNIS:
    'Konfigurasi sistem dan status antrean integrasi. Tidak punya akses baca isi klinis secara bawaan.',
}

export const ROLE_ORDER: Role[] = [
  'PENANGGUNG_JAWAB',
  'PPA',
  'PPA_PENDAMPING',
  'PENDAFTARAN',
  'REKAM_MEDIS',
  'KASIR',
  'ADMIN_TEKNIS',
  'PASIEN',
]

// ---------- Izin halaman administratif & klinis ----------

export type Permission =
  | 'profil_praktik.lihat'
  | 'profil_praktik.ubah'
  | 'pengguna.lihat'
  | 'pengguna.kelola'
  | 'audit.lihat'
  | 'pasien.lihat'
  | 'pasien.kelola'
  | 'kunjungan.daftar'
  | 'kunjungan.lihat'
  | 'kunjungan.klinis'
  | 'kunjungan.kunci'
  | 'kunjungan.buka'
  | 'resep.kelola'
  | 'resep.serahkan'
  | 'tindakan.kelola'
  | 'consent.kelola'
  | 'klaim.lihat'
  | 'klaim.kelola'
  | 'satusehat.lihat'
  | 'satusehat.kelola'
  | 'mutu.lihat'
  | 'terminologi.kelola'
  | 'rujukan.kelola'
  | 'portal.kelola'

const PERMISSION_MATRIX: Record<Permission, Role[]> = {
  'profil_praktik.lihat': [
    'PENANGGUNG_JAWAB',
    'ADMIN_TEKNIS',
    'PPA',
    'PPA_PENDAMPING',
    'PENDAFTARAN',
    'REKAM_MEDIS',
    'KASIR',
  ],
  'profil_praktik.ubah': ['PENANGGUNG_JAWAB'],
  'pengguna.lihat': ['PENANGGUNG_JAWAB', 'ADMIN_TEKNIS'],
  'pengguna.kelola': ['PENANGGUNG_JAWAB'],
  'audit.lihat': ['PENANGGUNG_JAWAB', 'ADMIN_TEKNIS', 'REKAM_MEDIS'],
  // registry (Fase 1)
  'pasien.lihat': [
    'PENANGGUNG_JAWAB',
    'PPA',
    'PPA_PENDAMPING',
    'PENDAFTARAN',
    'REKAM_MEDIS',
    'ADMIN_TEKNIS',
    'KASIR',
  ],
  'pasien.kelola': ['PENANGGUNG_JAWAB', 'PENDAFTARAN'],
  'kunjungan.daftar': ['PENDAFTARAN', 'PENANGGUNG_JAWAB', 'PPA'],
  'kunjungan.lihat': [
    'PENANGGUNG_JAWAB',
    'PPA',
    'PPA_PENDAMPING',
    'PENDAFTARAN',
    'REKAM_MEDIS',
    'ADMIN_TEKNIS',
    'KASIR',
  ],
  'kunjungan.klinis': ['PPA', 'PENANGGUNG_JAWAB', 'PPA_PENDAMPING'],
  'kunjungan.kunci': ['PPA', 'PENANGGUNG_JAWAB'],
  'kunjungan.buka': ['PENANGGUNG_JAWAB'],
  'resep.kelola': ['PPA', 'PENANGGUNG_JAWAB'],
  'resep.serahkan': ['PPA', 'PPA_PENDAMPING', 'KASIR', 'PENANGGUNG_JAWAB'],
  'tindakan.kelola': ['PPA', 'PENANGGUNG_JAWAB'],
  'consent.kelola': ['PPA', 'PENANGGUNG_JAWAB', 'PENDAFTARAN'],
  'klaim.lihat': ['KASIR', 'PENANGGUNG_JAWAB', 'ADMIN_TEKNIS', 'REKAM_MEDIS'],
  'klaim.kelola': ['KASIR', 'PENANGGUNG_JAWAB'],
  'satusehat.lihat': ['ADMIN_TEKNIS', 'PENANGGUNG_JAWAB', 'REKAM_MEDIS'],
  'satusehat.kelola': ['ADMIN_TEKNIS', 'PENANGGUNG_JAWAB'],
  'mutu.lihat': ['PENANGGUNG_JAWAB', 'REKAM_MEDIS', 'ADMIN_TEKNIS'],
  'terminologi.kelola': ['PENANGGUNG_JAWAB', 'REKAM_MEDIS', 'ADMIN_TEKNIS'],
  'rujukan.kelola': ['PPA', 'PENANGGUNG_JAWAB'],
  'portal.kelola': ['PENDAFTARAN', 'REKAM_MEDIS', 'PENANGGUNG_JAWAB'],
}

export function hasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some((r) => PERMISSION_MATRIX[permission].includes(r))
}

export function isClinicalRole(role: Role): boolean {
  return role === 'PPA' || role === 'PPA_PENDAMPING'
}

export function formatRoles(roles: Role[]): string {
  return roles.map((r) => ROLE_LABELS[r]).join(', ')
}
