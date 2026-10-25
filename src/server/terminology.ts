'use server'

// ============================================================
// e-SIMANTRI — Server Actions Fase 3 (Terminologi)
// Pencarian katalog referensi GLOBAL: ICD-10, ICD-9-CM, KFA.
//
// Aturan keras (master prompt + kepatuhan):
// - Katalog adalah data referensi global baca-saja; tidak ada
//   aksi ubah/hapus katalog di lapisan aplikasi.
// - Pencarian diberi izin 'terminologi.cari' (PPA, PPA Pendamping,
//   Rekam Medis). Penanggung Jawab, Pendaftaran, Kasir, Pasien,
//   dan Admin Teknis tidak mencari kode klinis.
// - Katalog pada seed hanya SUBSET CONTOH; produksi wajib
//   mengimpor katalog resmi Kemenkes.
// ============================================================

import { db } from '@/lib/db'
import { requireReadyContext } from '@/lib/auth'
import { cleanText } from '@/lib/completeness'
import type {
  Icd10OptionDTO,
  Icd9CmOptionDTO,
  KfaOptionDTO,
} from '@/lib/dto'

const TAKE_LIMIT = 15

/** Cari kode ICD-10 (per cocokan kode atau judul, tak peduli besar-kecil). */
export async function searchIcd10Action(query: string): Promise<Icd10OptionDTO[] | null> {
  const guard = await requireReadyContext('terminologi.cari')
  if (!guard.ok) return null

  const q = cleanText(query)
  if (!q) return []
  const needle = q.toLowerCase()

  const rows = await db.icd10Code.findMany({
    where: {
      OR: [
        { code: { contains: needle, mode: 'insensitive' } },
        { description: { contains: needle, mode: 'insensitive' } },
      ],
    },
    orderBy: { code: 'asc' },
    take: TAKE_LIMIT,
  })

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    description: r.description,
    chapter: r.chapter,
  }))
}

/** Cari kode tindakan ICD-9-CM. */
export async function searchIcd9CmAction(query: string): Promise<Icd9CmOptionDTO[] | null> {
  const guard = await requireReadyContext('terminologi.cari')
  if (!guard.ok) return null

  const q = cleanText(query)
  if (!q) return []
  const needle = q.toLowerCase()

  const rows = await db.icd9CmCode.findMany({
    where: {
      OR: [
        { code: { contains: needle, mode: 'insensitive' } },
        { description: { contains: needle, mode: 'insensitive' } },
      ],
    },
    orderBy: { code: 'asc' },
    take: TAKE_LIMIT,
  })

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    description: r.description,
    chapter: r.chapter,
  }))
}

/** Cari obat/alkes KFA (nama, bentuk sediaan, atau kode). */
export async function searchKfaAction(query: string): Promise<KfaOptionDTO[] | null> {
  const guard = await requireReadyContext('terminologi.cari')
  if (!guard.ok) return null

  const q = cleanText(query)
  if (!q) return []
  const needle = q.toLowerCase()

  const rows = await db.kfaCode.findMany({
    where: {
      OR: [
        { code: { contains: needle, mode: 'insensitive' } },
        { name: { contains: needle, mode: 'insensitive' } },
        { dosageForm: { contains: needle, mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
    take: TAKE_LIMIT,
  })

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    dosageForm: r.dosageForm,
    strength: r.strength,
    unit: r.unit,
  }))
}
