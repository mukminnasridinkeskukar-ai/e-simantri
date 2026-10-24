// ============================================================
// e-SIMANTRI — Pilihan penjamin pembayar (Fase 1)
// Label administratif semata; tidak ada integrasi BPJS pada
// Fase mana pun (integrasi klaim menyusul Fase 8 lewat antarmuka).
// Berada di lib (bukan 'use server') agar dapat dipakai klien & server.
// ============================================================

export const PAYER_OPTIONS: { value: string; label: string }[] = [
  { value: 'UMUM', label: 'Umum (bayar sendiri)' },
  { value: 'BPJS', label: 'BPJS Kesehatan' },
  { value: 'ASURANSI', label: 'Asuransi lainnya' },
  { value: 'LAINNYA', label: 'Lainnya' },
]

export function payerLabel(value: string | null | undefined): string {
  return PAYER_OPTIONS.find((p) => p.value === value)?.label ?? value ?? '—'
}

export const SEX_OPTIONS: { value: string; label: string }[] = [
  { value: 'LAKI_LAKI', label: 'Laki-laki' },
  { value: 'PEREMPUAN', label: 'Perempuan' },
]

export function sexLabel(value: string | null | undefined): string {
  return SEX_OPTIONS.find((p) => p.value === value)?.label ?? value ?? '—'
}
