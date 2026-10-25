'use server'

// ============================================================
// e-SIMANTRI — Server Actions Fase 3 (Kodifikasi & Resep)
// Diagnosis ICD-10, tindakan ICD-9-CM, dan resep KFA pada catatan.
//
// Aturan keras (master prompt + PMK 24/2022):
// - Hanya PPA PENULIS draf yang mengatur kode/resep (kodifikasi.kelola).
// - Saat DRAF: set kode boleh diganti penulisnya (sama seperti
//   teks draf). Setelah TERKUNCI: baris beku — koreksi hanya
//   lewat amandemen beralasan yang MENANDAI baris lama
//   (supersededAt) dan MENAMBAH baris baru (append-only, tanpa hapus).
// - Resep TIDAK dapat dihapus: resep salah DIBATALKAN dengan
//   alasan wajib dan tetap tersimpan.
// - Kode wajib berasal dari katalog referensi global.
// - Seluruh query terlingkup praktik aktif dari sesi server.
// ============================================================

import { db } from '@/lib/db'
import { clientMeta, requireReadyContext } from '@/lib/auth'
import { writeAuditSafe } from '@/lib/audit'
import { cleanText } from '@/lib/completeness'
import type {
  ActionResult,
  CodesInputDTO,
  PrescriptionItemInputDTO,
} from '@/lib/dto'

// ------------------------------------------------------------
// Helper
// ------------------------------------------------------------

const ROUTE_KEYS = ['ORAL', 'TOPIKAL', 'INHALASI', 'INJEKSI', 'LAINNYA'] as const

async function loadNoteContext(orgId: string, encounterId: string) {
  return db.encounter.findFirst({
    where: { id: encounterId, organizationId: orgId },
    include: {
      patient: { select: { fullName: true, mrn: true } },
      note: true,
    },
  })
}

function normalizePrimary(diagnoses: CodesInputDTO['diagnoses']) {
  // Pastikan maksimum satu diagnosis utama; sisanya sekunder.
  let primarySet = false
  return diagnoses.map((d) => {
    const isPrimary = d.isPrimary && !primarySet
    if (isPrimary) primarySet = true
    return { ...d, isPrimary }
  })
}

function snapshotOfActive(
  diagnoses: { icd10: { code: string; description: string }; isPrimary: boolean; noteText: string | null }[],
  procedures: { icd9Cm: { code: string; description: string }; noteText: string | null }[]
): string {
  return JSON.stringify({
    diagnoses: diagnoses.map((d) => ({
      code: d.icd10.code,
      description: d.icd10.description,
      isPrimary: d.isPrimary,
      noteText: d.noteText,
    })),
    procedures: procedures.map((p) => ({
      code: p.icd9Cm.code,
      description: p.icd9Cm.description,
      noteText: p.noteText,
    })),
  })
}

function describeCodes(input: CodesInputDTO): string {
  const dx = input.diagnoses.map((d) => d.icd10CodeId).length
  const pr = input.procedures.map((p) => p.icd9CmCodeId).length
  return `${dx} kode diagnosis, ${pr} kode tindakan`
}

// ------------------------------------------------------------
// Set kode pada DRAF — pengganti penuh, hanya penulis
// ------------------------------------------------------------

export async function setDraftCodesAction(
  encounterId: string,
  input: CodesInputDTO
): Promise<ActionResult> {
  const guard = await requireReadyContext('kodifikasi.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const enc = await loadNoteContext(orgId, encounterId)
  if (!enc) return { ok: false, error: 'Kunjungan tidak ditemukan di praktik ini.' }
  const note = enc.note
  if (!note) return { ok: false, error: 'Catatan belum dibuat; simpan draf terlebih dahulu.' }
  if (note.status === 'TERKUNCI')
    return { ok: false, error: 'Catatan sudah terkunci. Koreksi kode hanya lewat amandemen beralasan.' }
  if (note.authorUserId !== meId)
    return { ok: false, error: 'Hanya penulis draf yang dapat mengatur kodifikasinya.' }

  // Normalisasi & deduplikasi input
  const dxMap = new Map<string, { isPrimary: boolean; noteText: string | null }>()
  for (const d of normalizePrimary(input.diagnoses ?? [])) {
    dxMap.set(d.icd10CodeId, { isPrimary: d.isPrimary, noteText: cleanText(d.noteText ?? null) })
  }
  const prMap = new Map<string, { noteText: string | null }>()
  for (const p of input.procedures ?? []) {
    prMap.set(p.icd9CmCodeId, { noteText: cleanText(p.noteText ?? null) })
  }

  // Validasi: semua kode harus ada di katalog referensi global.
  const dxIds = [...dxMap.keys()]
  const prIds = [...prMap.keys()]
  const validDx = dxIds.length > 0
    ? await db.icd10Code.findMany({ where: { id: { in: dxIds } }, select: { id: true, code: true } })
    : []
  const validPr = prIds.length > 0
    ? await db.icd9CmCode.findMany({ where: { id: { in: prIds } }, select: { id: true, code: true } })
    : []
  if (validDx.length !== dxIds.length || validPr.length !== prIds.length) {
    return { ok: false, error: 'Ada kode yang tidak dikenal pada katalog. Pilih ulang dari daftar pencarian.' }
  }

  await db.$transaction([
    // Draf boleh diganti penuh — belum ada isi final yang hilang.
    db.noteDiagnosis.deleteMany({ where: { noteId: note.id, supersededAt: null } }),
    db.noteProcedure.deleteMany({ where: { noteId: note.id, supersededAt: null } }),
    db.noteDiagnosis.createMany({
      data: dxIds.map((icd10CodeId) => ({
        organizationId: orgId,
        noteId: note.id,
        icd10CodeId,
        isPrimary: dxMap.get(icd10CodeId)!.isPrimary,
        noteText: dxMap.get(icd10CodeId)!.noteText,
        enteredByUserId: meId,
      })),
    }),
    db.noteProcedure.createMany({
      data: prIds.map((icd9CmCodeId) => ({
        organizationId: orgId,
        noteId: note.id,
        icd9CmCodeId,
        noteText: prMap.get(icd9CmCodeId)!.noteText,
        enteredByUserId: meId,
      })),
    }),
  ])

  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: meId,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'KODIFIKASI_DISEMPAN',
    objectType: 'ClinicalNote',
    objectId: note.id,
    summary: `Kodifikasi draf catatan disimpan (${describeCodes(input)}) untuk ${enc.patient.fullName} (${enc.patient.mrn}).`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })

  return { ok: true, message: 'Kodifikasi draf disimpan.' }
}

// ------------------------------------------------------------
// Resep terstruktur — buat/ubah isi saat DRAF, batalkan kapan pun
// ------------------------------------------------------------

export async function savePrescriptionAction(
  encounterId: string,
  prescriptionId: string | null,
  items: PrescriptionItemInputDTO[]
): Promise<ActionResult> {
  const guard = await requireReadyContext('kodifikasi.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const enc = await loadNoteContext(orgId, encounterId)
  if (!enc) return { ok: false, error: 'Kunjungan tidak ditemukan di praktik ini.' }
  const note = enc.note
  if (!note) return { ok: false, error: 'Catatan belum dibuat; simpan draf terlebih dahulu.' }
  if (note.status === 'TERKUNCI')
    return { ok: false, error: 'Catatan terkunci — isi resep beku. Koreksi lewat amandemen catatan.' }
  if (note.authorUserId !== meId)
    return { ok: false, error: 'Hanya penulis draf yang dapat mengatur resepnya.' }

  // Normalisasi item
  const cleanItems = (items ?? []).map((it) => ({
    kfaCodeId: (it.kfaCodeId ?? '').trim(),
    drugName: (it.drugName ?? '').trim(),
    dose: cleanText(it.dose ?? null),
    route: (it.route ?? '').trim().toUpperCase(),
    frequency: cleanText(it.frequency ?? null),
    durationDays: typeof it.durationDays === 'number' && Number.isFinite(it.durationDays) && it.durationDays > 0
      ? Math.floor(it.durationDays)
      : null,
    quantity: cleanText(it.quantity ?? null),
    instructions: cleanText(it.instructions ?? null),
  }))
  if (cleanItems.length === 0)
    return { ok: false, error: 'Resep harus memiliki minimal satu item obat/alkes.' }
  if (cleanItems.some((it) => !it.kfaCodeId))
    return { ok: false, error: 'Setiap item resep wajib memilih obat dari katalog KFA.' }
  if (cleanItems.some((it) => !ROUTE_KEYS.includes(it.route as (typeof ROUTE_KEYS)[number])))
    return { ok: false, error: 'Jalur pemberian obat tidak dikenal.' }

  // Validasi katalog & pakai nama obat resmi katalog sebagai snapshot.
  const kfaRows = await db.kfaCode.findMany({
    where: { id: { in: cleanItems.map((it) => it.kfaCodeId) } },
  })
  if (kfaRows.length !== new Set(cleanItems.map((it) => it.kfaCodeId)).size) {
    return { ok: false, error: 'Ada obat yang tidak dikenal pada katalog KFA. Pilih ulang dari pencarian.' }
  }
  const kfaById = new Map(kfaRows.map((k) => [k.id, k]))

  const isNew = !prescriptionId
  let number: string

  if (isNew) {
    // Nomor resep unik per praktik — increment atomik (pola MRN).
    const org = await db.organization.update({
      where: { id: orgId },
      data: { rxCounter: { increment: 1 } },
      select: { rxCounter: true },
    })
    number = `RESEP-${String(org.rxCounter).padStart(4, '0')}`

    await db.prescription.create({
      data: {
        organizationId: orgId,
        noteId: note.id,
        number,
        status: 'AKTIF',
        createdByUserId: meId,
        items: {
          create: cleanItems.map((it) => {
            const k = kfaById.get(it.kfaCodeId)!
            return {
              kfaCodeId: k.id,
              drugName: [k.name, k.strength].filter(Boolean).join(' '),
              dose: it.dose,
              route: it.route,
              frequency: it.frequency,
              durationDays: it.durationDays,
              quantity: it.quantity,
              instructions: it.instructions,
            }
          }),
        },
      },
    })

    const meta = await clientMeta()
    await writeAuditSafe({
      organizationId: orgId,
      actorUserId: meId,
      actorName: guard.state.me.fullName,
      actorRole: ctx.role,
      action: 'RESEP_DIBUAT',
      objectType: 'Prescription',
      objectId: note.id,
      summary: `Resep ${number} terbit (${cleanItems.length} item) untuk ${enc.patient.fullName} (${enc.patient.mrn}).`,
      ip: meta.ip,
      userAgent: meta.userAgent,
      sessionId: ctx.membershipId,
    })
    return { ok: true, message: `Resep ${number} tersimpan.` }
  }

  // Ubah isi resep DRAF yang sudah ada (ganti seluruh item, nomor tetap).
  const existing = await db.prescription.findFirst({
    where: { id: prescriptionId!, organizationId: orgId, noteId: note.id },
    include: { items: true },
  })
  if (!existing) return { ok: false, error: 'Resep tidak ditemukan pada catatan ini.' }
  if (existing.status === 'DIBATALKAN')
    return { ok: false, error: 'Resep sudah dibatalkan dan tidak dapat diubah.' }

  await db.$transaction([
    db.prescriptionItem.deleteMany({ where: { prescriptionId: existing.id } }),
    db.prescriptionItem.createMany({
      data: cleanItems.map((it) => {
        const k = kfaById.get(it.kfaCodeId)!
        return {
          prescriptionId: existing.id,
          kfaCodeId: k.id,
          drugName: [k.name, k.strength].filter(Boolean).join(' '),
          dose: it.dose,
          route: it.route,
          frequency: it.frequency,
          durationDays: it.durationDays,
          quantity: it.quantity,
          instructions: it.instructions,
        }
      }),
    }),
  ])

  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: meId,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'RESEP_DISEMPAN',
    objectType: 'Prescription',
    objectId: existing.id,
    summary: `Resep ${existing.number} diperbarui (${cleanItems.length} item) untuk ${enc.patient.fullName} (${enc.patient.mrn}).`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })
  return { ok: true, message: `Resep ${existing.number} diperbarui.` }
}

export async function voidPrescriptionAction(
  encounterId: string,
  prescriptionId: string,
  reason: string
): Promise<ActionResult> {
  const guard = await requireReadyContext('kodifikasi.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const reasonText = cleanText(reason)
  if (!reasonText) return { ok: false, error: 'Alasan pembatalan resep wajib diisi.' }

  const enc = await loadNoteContext(orgId, encounterId)
  if (!enc?.note) return { ok: false, error: 'Catatan tidak ditemukan.' }
  const note = enc.note
  if (note.authorUserId !== meId)
    return { ok: false, error: 'Hanya PPA penulis catatan yang dapat membatalkan resepnya.' }

  const rx = await db.prescription.findFirst({
    where: { id: prescriptionId, organizationId: orgId, noteId: note.id },
  })
  if (!rx) return { ok: false, error: 'Resep tidak ditemukan pada catatan ini.' }
  if (rx.status === 'DIBATALKAN') return { ok: false, error: 'Resep sudah dibatalkan sebelumnya.' }

  await db.prescription.update({
    where: { id: rx.id },
    data: {
      status: 'DIBATALKAN',
      voidReason: reasonText,
      voidedAt: new Date(),
      voidedByUserId: meId,
    },
  })

  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: meId,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'RESEP_DIBATALKAN',
    objectType: 'Prescription',
    objectId: rx.id,
    summary: `Resep ${rx.number} DIBATALKAN untuk ${enc.patient.fullName} (${enc.patient.mrn}). Alasan: ${reasonText}`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })

  return { ok: true, message: `Resep ${rx.number} dibatalkan dan tetap tercatat.` }
}
