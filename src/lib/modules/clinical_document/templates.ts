// ============================================================
// MODUL: clinical_document — definisi templat per profesi (Fase 2 & 7)
//
// Field wajib mengikuti daftar minimal rekam medis rawat jalan pada
// PMK 24/2022: anamnesis (termasuk riwayat alergi), pemeriksaan,
// hasil penunjang bila dilakukan, diagnosa, tata laksana/terapi,
// edukasi, serta identitas PPA yang otomatis dari akun.
// Templat ditampilkan sebagai bagian (section) berisi field terstruktur
// agar bisa dipetakan ke FHIR pada Fase 5.
// ============================================================

export type FieldType = 'text' | 'textarea' | 'number' | 'select'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  required?: boolean
  unit?: string
  placeholder?: string
}

export interface SectionDef {
  key: string
  label: string
  description?: string
  fields: FieldDef[]
  /// Boleh disunting PPA pendamping (asesmen awal).
  pendampingBoleh?: boolean
  /// Bila true, bagian ini boleh "tidak ada / tidak dilakukan" (opsional).
  opsional?: boolean
}

export interface TemplateDef {
  key: string
  label: string
  sections: SectionDef[]
}

const TANDA_VITAL: SectionDef = {
  key: 'tanda_vital',
  label: 'Tanda vital',
  description: 'Diisi PPA / PPA pendamping.',
  pendampingBoleh: true,
  fields: [
    { key: 'td', label: 'Tekanan darah', type: 'text', required: true, placeholder: 'mis. 120/80 mmHg' },
    { key: 'nadi', label: 'Nadi', type: 'number', unit: 'x/menit', required: true },
    { key: 'suhu', label: 'Suhu', type: 'number', unit: '°C', required: true },
    { key: 'rr', label: 'Pernapasan', type: 'number', unit: 'x/menit', required: true },
    { key: 'spo2', label: 'Saturasi oksigen', type: 'number', unit: '%', required: true },
    { key: 'berat', label: 'Berat badan', type: 'number', unit: 'kg' },
    { key: 'tinggi', label: 'Tinggi badan', type: 'number', unit: 'cm' },
  ],
}

const SEKSI_ANAMNESIS: SectionDef = {
  key: 'anamnesis',
  label: 'Anamnesis',
  pendampingBoleh: true,
  fields: [
    { key: 'keluhan_utama', label: 'Keluhan utama', type: 'textarea', required: true },
    { key: 'riwayat_sekarang', label: 'Riwayat penyakit sekarang', type: 'textarea', required: true },
    { key: 'riwayat_dahulu', label: 'Riwayat penyakit dahulu', type: 'textarea', required: true },
    {
      key: 'alergi',
      label: 'Riwayat alergi',
      type: 'select',
      options: ['Tidak ada riwayat alergi', 'Ada — dijelaskan di bawah', 'Tidak diketahui'],
      required: true,
    },
    { key: 'alergi_detail', label: 'Rincian alergi (bila ada)', type: 'text' },
    { key: 'obat_dipakai', label: 'Obat yang sedang dipakai', type: 'text' },
  ],
}

const SEKSI_PEMERIKSAAN: SectionDef = {
  key: 'pemeriksaan',
  label: 'Pemeriksaan',
  description: 'Hasil inspeksi/palpasi/percussion/auskultasi yang relevan.',
  pendampingBoleh: true,
  fields: [
    { key: 'kepala_leher', label: 'Kepala & leher', type: 'textarea', required: true },
    { key: 'dada', label: 'Dada (jantung & paru)', type: 'textarea', required: true },
    { key: 'perut', label: 'Perut', type: 'textarea', required: true },
    { key: 'ekstremitas', label: 'Ekstremitas & kulit', type: 'textarea', required: true },
    { key: 'lainnya', label: 'Catatan pemeriksaan lain', type: 'textarea' },
  ],
}

const SEKSI_PENUNJANG: SectionDef = {
  key: 'penunjang',
  label: 'Hasil penunjang (bila dilakukan)',
  opsional: true,
  fields: [
    { key: 'ringkasan', label: 'Ringkasan hasil laboratorium / radiologi', type: 'textarea' },
  ],
}

const SEKSI_RENCANA: SectionDef = {
  key: 'rencana',
  label: 'Rencana tatalaksana & edukasi',
  fields: [
    { key: 'tatalaksana', label: 'Rencana tatalaksana', type: 'textarea', required: true },
    { key: 'edukasi', label: 'Edukasi yang diberikan', type: 'textarea', required: true },
    { key: 'tindak_lanjut', label: 'Rencana tindak lanjut / kontrol', type: 'text', required: true },
  ],
}

/// Templat umum: dokter, perawat, bidan, dan profesi non-gigi lain.
export const TEMPLATE_UMUM: TemplateDef = {
  key: 'UMUM',
  label: 'Catatan pemeriksaan umum',
  sections: [SEKSI_ANAMNESIS, TANDA_VITAL, SEKSI_PEMERIKSAAN, SEKSI_PENUNJANG, SEKSI_RENCANA],
}

/// Templat khusus nakes non-dokter: pemeriksaan fokus + batas kewenangan.
export const TEMPLATE_PENDAMPING: TemplateDef = {
  key: 'PENDAMPING',
  label: 'Catatan asesmen keperawatan/kebidanan',
  sections: [
    SEKSI_ANAMNESIS,
    TANDA_VITAL,
    {
      key: 'pemeriksaan',
      label: 'Pemeriksaan keperawatan/kebidanan',
      pendampingBoleh: true,
      fields: [
        { key: 'kepala_leher', label: 'Kepala & leher', type: 'textarea', required: true },
        { key: 'dada', label: 'Dada (jantung & paru)', type: 'textarea', required: true },
        { key: 'perut', label: 'Perut', type: 'textarea', required: true },
        { key: 'ekstremitas', label: 'Ekstremitas & kulit', type: 'textarea', required: true },
        { key: 'lainnya', label: 'Catatan pemeriksaan lain', type: 'textarea' },
      ],
    },
    {
      key: 'rencana',
      label: 'Asuhan & rujukan bila perlu',
      fields: [
        { key: 'tatalaksana', label: 'Asuhan yang diberikan', type: 'textarea', required: true },
        { key: 'edukasi', label: 'Edukasi yang diberikan', type: 'textarea', required: true },
        { key: 'tindak_lanjut', label: 'Rencana tindak lanjut / rujukan', type: 'text', required: true },
      ],
    },
  ],
}

/// Profesi non-klinis medis (gizi, fisioterapi, psikologi): penilaian khusus.
export const TEMPLATE_PROFESI_LAIN: TemplateDef = {
  key: 'PROFESI_LAIN',
  label: 'Catatan asesmen profesi',
  sections: [
    {
      key: 'anamnesis',
      label: 'Keluhan & riwayat',
      fields: [
        { key: 'keluhan_utama', label: 'Keluhan / tujuan kunjungan', type: 'textarea', required: true },
        { key: 'riwayat_sekarang', label: 'Riwayat kondisi sekarang', type: 'textarea', required: true },
        {
          key: 'alergi',
          label: 'Riwayat alergi',
          type: 'select',
          options: ['Tidak ada riwayat alergi', 'Ada — dijelaskan di bawah', 'Tidak diketahui'],
          required: true,
        },
        { key: 'alergi_detail', label: 'Rincian alergi (bila ada)', type: 'text' },
      ],
    },
    {
      key: 'asesmen',
      label: 'Penilaian profesi',
      description: 'Antropometri (gizi), pengukuran gerak (fisioterapi), atau asesmen psikologis (psikologi).',
      fields: [
        { key: 'temuan', label: 'Temuan penilaian', type: 'textarea', required: true },
        { key: 'kesimpulan', label: 'Kesimpulan / status', type: 'textarea', required: true },
      ],
    },
    {
      key: 'rencana',
      label: 'Rencana intervensi',
      fields: [
        { key: 'tatalaksana', label: 'Intervensi / program', type: 'textarea', required: true },
        { key: 'edukasi', label: 'Edukasi yang diberikan', type: 'textarea', required: true },
        { key: 'tindak_lanjut', label: 'Rencana tindak lanjut / kontrol', type: 'text', required: true },
      ],
    },
  ],
}

/// Templat dokter gigi + odontogram (Fase 7).
export const TEMPLATE_GIGI: TemplateDef = {
  key: 'GIGI',
  label: 'Catatan pemeriksaan dokter gigi',
  sections: [
    SEKSI_ANAMNESIS,
    TANDA_VITAL,
    {
      key: 'pemeriksaan_mulut',
      label: 'Pemeriksaan rongga mulut',
      fields: [
        { key: 'mukosa', label: 'Mukosa mulut', type: 'textarea', required: true },
        { key: 'gusi', label: 'Gusi & jaringan penunjang', type: 'textarea', required: true },
        { key: 'gigi', label: 'Kondisi gigi (ringkasan)', type: 'textarea', required: true },
        { key: 'lainnya', label: 'Catatan lain', type: 'textarea' },
      ],
    },
    {
      key: 'odontogram_ref',
      label: 'Odontogram',
      description: 'Peta kondisi 32 gigi diisi pada bagian Odontogram di ruang kerja kunjungan.',
      fields: [{ key: 'ringkasan', label: 'Ringkasan odontogram', type: 'text', required: true }],
    },
    SEKSI_PENUNJANG,
    SEKSI_RENCANA,
  ],
}

export function templateUntukProfesi(profesi: string | null | undefined): TemplateDef {
  switch (profesi) {
    case 'Dokter':
      return TEMPLATE_UMUM
    case 'Dokter Gigi':
      return TEMPLATE_GIGI
    case 'Perawat':
    case 'Bidan':
      return TEMPLATE_PENDAMPING
    case 'Apoteker':
    case 'Ahli Gizi':
    case 'Fisioterapis':
    case 'Terapis Wicara':
    case 'Okupasi Terapis':
    case 'Analis Kesehatan':
    case 'Psikolog Klinis':
      return TEMPLATE_PROFESI_LAIN
    default:
      return TEMPLATE_UMUM
  }
}

export type IsiDokumen = Record<string, Record<string, string>>

/// Kepatuhan: daftar bagian wajib yang belum terisi untuk kunjungan ini.
export function cekKelengkapan(
  template: TemplateDef,
  isi: IsiDokumen | null,
  opsi: { adaDiagnosa: boolean; adaOdontogram: boolean; adaTerapi: boolean }
): string[] {
  const kurang: string[] = []
  if (!isi) {
    kurang.push('Catatan pemeriksaan belum dibuat')
    return kurang
  }
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (!field.required) continue
      const nilai = isi[section.key]?.[field.key]?.trim()
      if (!nilai) kurang.push(`${section.label}: ${field.label}`)
    }
  }
  if (!opsi.adaDiagnosa) kurang.push('Diagnosa (minimal satu, dengan kode ICD-10)')
  if (template.key === 'GIGI' && !opsi.adaOdontogram) kurang.push('Odontogram')
  if (!opsi.adaTerapi) kurang.push('Terapi/resep atau rencana tatalaksana yang mencakup pengobatan')
  return kurang
}

/// Kondisi gigi odontogram (Fase 7).
export const KONDISI_GIGI = [
  'SEHAT',
  'KARIES',
  'HILANG',
  'DICABUT',
  'RESTORASI',
  'MAHKOTA',
  'AKAR_SISA',
] as const
export type KondisiGigi = (typeof KONDISI_GIGI)[number]
export const KONDISI_GIGI_LABELS: Record<string, string> = {
  SEHAT: 'Sehat',
  KARIES: 'Karies',
  HILANG: 'Hilang',
  DICABUT: 'Dicabut',
  RESTORASI: 'Restorasi',
  MAHKOTA: 'Mahkota',
  AKAR_SISA: 'Akar sisa',
}
export const NOMOR_GIGI_FDI = [
  ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'],
  ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'],
]
