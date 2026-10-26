// ============================================================
// MODUL: audit — logger append-only
//
// Aturan:
// - Hanya menulis (create). Tidak ada fungsi ubah/hapus di berkas ini
//   maupun di tempat lain pada lapisan aplikasi.
// - Tidak boleh memuat sandi, token, kunci, atau NIK lengkap pada
//   summary/detail.
// - detail disimpan sebagai teks JSON.
// ============================================================

import { db } from '@/lib/db'

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_GAGAL'
  | 'LOGOUT'
  | 'GANTI_ORGANISASI'
  | 'TAMBAH_PENGGUNA'
  | 'UBAH_PERAN'
  | 'STATUS_PENGGUNA'
  | 'RESET_SANDI'
  | 'UBAH_SANDI'
  | 'UBAH_PROFIL_PRAKTIK'
  | 'LIHAT_AUDIT'
  | 'TAMBAH_PASIEN'
  | 'UBAH_PASIEN'
  | 'STATUS_PASIEN'
  | 'LIHAT_PASIEN'
  | 'BUAT_KUNJUNGAN'
  | 'STATUS_KUNJUNGAN'
  | 'KUNCI_KUNJUNGAN'
  | 'BUKA_KUNJUNGAN'
  | 'LIHAT_KUNJUNGAN'
  | 'SIMPAN_CATATAN'
  | 'TAMBAH_TINDAKAN'
  | 'SIMPAN_RESEP'
  | 'STATUS_RESEP'
  | 'CATAT_PERSETUJUAN'
  | 'SIMPAN_TAGIHAN'
  | 'STATUS_TAGIHAN'
  | 'BUAT_RUJUKAN'
  | 'SATUSEHAT_KONFIG'
  | 'OUTBOX_PROSES'
  | 'PORTAL_KODE'
  | 'PORTAL_LOGIN'
  | 'PORTAL_AKSES'
  | 'CETAK_RESUME'
  | 'CETAK_RESEP'
  | 'CETAK_RUJUKAN'
  | 'EKSPOR_KLAIM'
  | 'TAMBAH_TERMINOLOGI'

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: 'Masuk akun',
  LOGIN_GAGAL: 'Percobaan masuk gagal',
  LOGOUT: 'Keluar akun',
  GANTI_ORGANISASI: 'Pilih / pindah praktik aktif',
  TAMBAH_PENGGUNA: 'Tambah pengguna pada praktik',
  UBAH_PERAN: 'Ubah peran pengguna',
  STATUS_PENGGUNA: 'Aktifkan / nonaktifkan pengguna',
  RESET_SANDI: 'Atur ulang kata sandi pengguna',
  UBAH_SANDI: 'Ubah kata sandi sendiri',
  UBAH_PROFIL_PRAKTIK: 'Ubah profil tempat praktik',
  LIHAT_AUDIT: 'Membuka jejak audit',
  TAMBAH_PASIEN: 'Daftarkan pasien baru',
  UBAH_PASIEN: 'Ubah data pasien',
  STATUS_PASIEN: 'Aktifkan / nonaktifkan pasien',
  LIHAT_PASIEN: 'Membuka berkas pasien',
  BUAT_KUNJUNGAN: 'Daftarkan kunjungan baru',
  STATUS_KUNJUNGAN: 'Ubah status kunjungan',
  KUNCI_KUNJUNGAN: 'Kunci kunjungan',
  BUKA_KUNJUNGAN: 'Buka kunci kunjungan (koreksi)',
  LIHAT_KUNJUNGAN: 'Membuka ruang kerja kunjungan',
  SIMPAN_CATATAN: 'Simpan catatan pemeriksaan (versi baru)',
  TAMBAH_TINDAKAN: 'Catat tindakan pada kunjungan',
  SIMPAN_RESEP: 'Simpan resep',
  STATUS_RESEP: 'Ubah status resep (diserahkan / dibatalkan)',
  CATAT_PERSETUJUAN: 'Catat persetujuan pasien',
  SIMPAN_TAGIHAN: 'Simpan / terbitkan tagihan',
  STATUS_TAGIHAN: 'Ubah status tagihan (dibayar / dibatalkan)',
  BUAT_RUJUKAN: 'Buat surat rujukan',
  SATUSEHAT_KONFIG: 'Ubah konfigurasi integrasi SATUSEHAT',
  OUTBOX_PROSES: 'Proses antrean kirim SATUSEHAT',
  PORTAL_KODE: 'Buat / atur ulang kode akses portal pasien',
  PORTAL_LOGIN: 'Pasien masuk portal',
  PORTAL_AKSES: 'Pasien membuka riwayat di portal',
  CETAK_RESUME: 'Cetak / salin resume medis',
  CETAK_RESEP: 'Cetak salinan resep',
  CETAK_RUJUKAN: 'Cetak surat rujukan',
  EKSPOR_KLAIM: 'Ekspor data klaim (CSV)',
  TAMBAH_TERMINOLOGI: 'Tambah kode terminologi kustom',
}

export interface AuditInput {
  organizationId?: string | null
  userId?: string | null
  userLabel?: string | null
  roleLabel?: string | null
  action: AuditAction
  objectType?: string | null
  objectId?: string | null
  summary: string
  detail?: Record<string, unknown> | null
  reason?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function tulisAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        userLabel: input.userLabel ?? null,
        roleLabel: input.roleLabel ?? null,
        action: input.action,
        objectType: input.objectType ?? null,
        objectId: input.objectId ?? null,
        summary: input.summary,
        detail: input.detail ? JSON.stringify(input.detail) : null,
        reason: input.reason ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 255) : null,
      },
    })
  } catch {
    // Jejak audit gagal menulis tidak boleh membatalkan aksi utama,
    // tetapi kesalahan dilaporkan ke log server untuk ditindaklanjuti.
    console.error('[audit] gagal menulis jejak audit:', input.action)
  }
}
