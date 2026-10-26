// ============================================================
// MODUL: konstanta & util lintas fase
// Label berbahasa Indonesia, alur status kunjungan, pembuat nomor
// dokumen per organisasi (RM / KJG / RSP / INV / RUJ).
// ============================================================

import { db } from '@/lib/db'

// ---------- Status kunjungan ----------

export const ENCOUNTER_STATUS = [
  'TERDAFTAR',
  'DIPERIKSA',
  'SELESAI',
  'DIKUNCI',
  'TERKIRIM',
  'GAGAL_KIRIM',
  'BATAL',
] as const
export type EncounterStatus = (typeof ENCOUNTER_STATUS)[number]

export const ENCOUNTER_STATUS_LABELS: Record<EncounterStatus, string> = {
  TERDAFTAR: 'Terdaftar',
  DIPERIKSA: 'Diperiksa',
  SELESAI: 'Selesai',
  DIKUNCI: 'Dikunci',
  TERKIRIM: 'Terkirim',
  GAGAL_KIRIM: 'Gagal kirim',
  BATAL: 'Batal',
}

export const ENCOUNTER_TYPES = ['DATANG_SENDIRI', 'PERJANJIAN', 'TELEMEDISIN', 'KUNJUNGAN_RUMAH'] as const
export type EncounterType = (typeof ENCOUNTER_TYPES)[number]

export const ENCOUNTER_TYPE_LABELS: Record<EncounterType, string> = {
  DATANG_SENDIRI: 'Datang sendiri',
  PERJANJIAN: 'Perjanjian',
  TELEMEDISIN: 'Telemedisin',
  KUNJUNGAN_RUMAH: 'Kunjungan rumah',
}

// ---------- Cara pembayaran ----------

export const PAYMENT_METHODS = ['UANG_SENDIRI', 'ASURANSI', 'LAINNYA'] as const
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  UANG_SENDIRI: 'Biaya sendiri',
  ASURANSI: 'Asuransi',
  LAINNYA: 'Lainnya',
}

// ---------- Status lain ----------

export const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  DIBUAT: 'Menunggu diserahkan',
  DISELESAIKAN: 'Sudah diserahkan',
  DIBATALKAN: 'Dibatalkan',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draf',
  TERBIT: 'Diterbitkan',
  DIBAYAR: 'Dibayar',
  DIBATALKAN: 'Dibatalkan',
}

export const CONSENT_TYPE_LABELS: Record<string, string> = {
  PERSETUJUAN_UMUM: 'Persetujuan umum perawatan',
  TINDAKAN: 'Persetujuan tindakan',
  TELEMEDISIN: 'Persetujuan telemedisin',
  PENGAJUAN_DATA: 'Persetujuan pengajuan data',
}

export const OUTBOX_STATUS_LABELS: Record<string, string> = {
  ANTRE: 'Menunggu',
  TERKIRIM: 'Terkirim',
  GAGAL_VALIDASI: 'Gagal validasi',
  GAGAL_KIRIM: 'Gagal kirim',
}

export const OUTBOX_EVENT_LABELS: Record<string, string> = {
  PATIENT: 'Pasien (FHIR Patient)',
  ENCOUNTER: 'Kunjungan (FHIR Encounter)',
  CONDITION: 'Diagnosa (FHIR Condition)',
  OBSERVATION: 'Tanda vital (FHIR Observation)',
  PROCEDURE: 'Tindakan (FHIR Procedure)',
  MEDICATIONREQUEST: 'Resep (FHIR MedicationRequest)',
  COMPOSITION: 'Resume (FHIR Composition)',
}

// ---------- Format ----------

export function formatTanggal(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatWaktuLengkap(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export function hitungUmur(tglLahir: Date | null | undefined): string {
  if (!tglLahir) return '—'
  const hariIni = new Date()
  let umur = hariIni.getFullYear() - tglLahir.getFullYear()
  const m = hariIni.getMonth() - tglLahir.getMonth()
  if (m < 0 || (m === 0 && hariIni.getDate() < tglLahir.getDate())) umur -= 1
  return `${umur} tahun`
}

// ---------- Pembuat nomor per organisasi ----------

async function nomorBerikut(
  organizationId: string,
  model: 'patient' | 'encounter' | 'prescription' | 'invoice' | 'referral',
  field: 'medicalRecordNumber' | 'encounterNumber' | 'prescriptionNumber' | 'invoiceNumber' | 'letterNumber',
  prefix: string
): Promise<string> {
  const bulan = new Date().toISOString().slice(0, 7).replace('-', '')
  let urut = 1

  if (model === 'patient') {
    const jumlah = await db.patient.count({ where: { organizationId } })
    urut = jumlah + 1
    // Cari slot bebas agar unik walau data lama pernah dibuat manual.
    for (let i = 0; i < 50; i += 1) {
      const kandidat = `${prefix}-${String(urut).padStart(5, '0')}`
      const ada = await db.patient.findFirst({
        where: { organizationId, medicalRecordNumber: kandidat },
        select: { id: true },
      })
      if (!ada) return kandidat
      urut += 1
    }
  }

  const tabel = { encounter: db.encounter, prescription: db.prescription, invoice: db.invoice, referral: db.referral } as const
  const kolomField = {
    encounter: 'encounterNumber',
    prescription: 'prescriptionNumber',
    invoice: 'invoiceNumber',
    referral: 'letterNumber',
  } as const

  const sekarang = `${prefix}-${bulan}`
  for (let i = 0; i < 50; i += 1) {
    // @ts-expect-error akses dinamis tabel prisma dengan field unik per org
    const ada = await tabel[model].findFirst({
      where: { organizationId, [kolomField[model]]: `${sekarang}-${String(urut).padStart(4, '0')}` },
      select: { id: true },
    })
    if (!ada) return `${sekarang}-${String(urut).padStart(4, '0')}`
    urut += 1
  }
  throw new Error('Tidak berhasil membuat nomor unik setelah 50 percobaan')
}

export function nomorRM(organizationId: string) {
  return nomorBerikut(organizationId, 'patient', 'medicalRecordNumber', 'RM')
}
export function nomorKunjungan(organizationId: string) {
  return nomorBerikut(organizationId, 'encounter', 'encounterNumber', 'KJG')
}
export function nomorResep(organizationId: string) {
  return nomorBerikut(organizationId, 'prescription', 'prescriptionNumber', 'RSP')
}
export function nomorTagihan(organizationId: string) {
  return nomorBerikut(organizationId, 'invoice', 'invoiceNumber', 'INV')
}
export function nomorRujukan(organizationId: string) {
  return nomorBerikut(organizationId, 'referral', 'letterNumber', 'RUJ')
}
