// ============================================================
// e-SIMANTRI — Validator kelengkapan catatan klinis (Fase 2)
//
// Isi minimum rekam medis mengikuti PMK No. 24 Tahun 2022.
// Fungsi ini MURNI (tanpa akses database) agar mudah diuji
// otomatis dan dipakai bersama oleh server actions maupun UI.
// Penguncian catatan ditolak bila bagian wajib belum lengkap.
// ============================================================

import type { CompletenessDTO, NoteContentDTO } from '@/lib/dto'

/** Bagian catatan yang WAJIB terisi sebelum catatan boleh dikunci. */
export const REQUIRED_NOTE_FIELDS = [
  { field: 'subjective', label: 'Keluhan utama dan riwayat penyakit' },
  { field: 'allergiesNote', label: 'Alergi dan riwayat pemakaian obat yang relevan' },
  { field: 'objective', label: 'Hasil pemeriksaan fisik/tambahan' },
  { field: 'assessment', label: 'Diagnosis' },
  { field: 'plan', label: 'Rencana penatalaksanaan' },
  { field: 'medsGiven', label: 'Obat/tindakan yang diberikan (tulis "Tidak ada" bila memang tidak ada)' },
  { field: 'education', label: 'Edukasi yang diberikan kepada pasien/keluarga' },
] as const satisfies readonly { field: keyof NoteContentDTO; label: string }[]

/** Bagian catatan yang opsional pada Fase 2. */
export const OPTIONAL_NOTE_FIELDS = [
  { field: 'supportingExam', label: 'Hasil pemeriksaan penunjang (jika ada)' },
  { field: 'otherServices', label: 'Pelayanan lainnya' },
  { field: 'followUpPlan', label: 'Rencana tindak lanjut/kontrol' },
] as const satisfies readonly { field: keyof NoteContentDTO; label: string }[]

function filled(value: string | null | undefined): boolean {
  const t = (value ?? '').trim()
  return t.length > 0
}

/**
 * Periksa kelengkapan bagian wajib. Bila belum lengkap, kembalikan
 * daftar bagian yang masih kosong agar dapat ditampilkan pada UI
 * dan ditolak di sisi server saat penguncian.
 */
export function checkCompleteness(content: Partial<NoteContentDTO>): CompletenessDTO {
  const missing = REQUIRED_NOTE_FIELDS.filter((f) => !filled(content[f.field])).map((f) => ({
    field: f.field,
    label: f.label,
  }))
  return { ready: missing.length === 0, missing }
}

/** Rapikan input teks: kosong → null, sisanya di-trim. */
export function cleanText(value: string | null | undefined): string | null {
  const t = (value ?? '').trim()
  return t.length > 0 ? t : null
}
