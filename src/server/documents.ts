'use server'

// ============================================================
// e-SIMANTRI — Server Actions Fase 4 (Ringkasan & Salinan Pasien)
// Modul dokumen pemberian ke pasien: RINGKASAN PELAYANAN dan
// SALINAN CATATAN KLINIS (hak pasien atas salinan RM — PMK 24/2022).
//
// Aturan keras (master prompt + PMK 24/2022):
// - Dokumen diterbitkan HANYA dari catatan berstatus TERKUNCI.
// - PPA menerbitkan dari catatan miliknya; Rekam Medis dapat
//   menerbitkan untuk tugas administrasi salinan — seluruhnya
//   diaudit. Penanggung Jawab tidak menerbitkan/membuka isi.
// - Dokumen menyimpan SNAPSHOT identitas + isi saat penerbitan;
//   TIDAK tersedia fungsi ubah/hapus. Koreksi setelahnya lewat
//   amandemen catatan → terbitkan dokumen baru dengan nomor baru.
// - Nomor unik per praktik: RINGKASAN-xxxx / SALINAN-xxxx (atomik).
// - Membuka halaman cetak oleh pihak selain penerbit diaudit.
// - Seluruh query terlingkup praktik aktif dari sesi server.
// ============================================================

import { db } from '@/lib/db'
import { clientMeta, requireReadyContext } from '@/lib/auth'
import { writeAuditSafe } from '@/lib/audit'
import { cleanText } from '@/lib/completeness'
import { describeKind } from '@/lib/payer'
import type {
  SummaryDocContentDTO,
  SummaryDocDetailDTO,
  SummaryDocIssueInputDTO,
  SummaryDocIssueResult,
  SummaryDocKind,
  SummaryDocPatientDTO,
  SummaryDocRowDTO,
} from '@/lib/dto'

// ------------------------------------------------------------
// Helper
// ------------------------------------------------------------

const KINDS: readonly SummaryDocKind[] = ['RINGKASAN_PELAYANAN', 'SALINAN_CATATAN']
const RELATIONS = ['PASIEN', 'KELUARGA', 'KUASA_HUKUM', 'LAINNYA'] as const

function maskNationalId(nik: string | null): string | null {
  if (!nik) return null
  const t = nik.trim()
  if (t.length <= 6) return '••••••'
  return `${t.slice(0, 4)}${'•'.repeat(Math.max(t.length - 6, 4))}${t.slice(-2)}`
}

/** Konteks lengkap satu kunjungan+catatan untuk pembentukan snapshot dokumen. */
async function loadDocContext(orgId: string, encounterId: string) {
  return db.encounter.findFirst({
    where: { id: encounterId, organizationId: orgId },
    include: {
      patient: true,
      note: {
        include: {
          author: { select: { fullName: true } },
          diagnoses: {
            where: { supersededAt: null },
            include: { icd10: true },
            orderBy: { createdAt: 'asc' as const },
          },
          procedures: {
            where: { supersededAt: null },
            include: { icd9Cm: true },
            orderBy: { createdAt: 'asc' as const },
          },
          prescriptions: {
            orderBy: { createdAt: 'asc' as const },
            include: {
              items: {
                include: { kfaCode: true },
                orderBy: { createdAt: 'asc' as const },
              },
            },
          },
        },
      },
    },
  })
}

type DocContext = NonNullable<Awaited<ReturnType<typeof loadDocContext>>>

function patientSnapshotOf(p: DocContext['patient']): string {
  const snap: SummaryDocPatientDTO = {
    fullName: p.fullName,
    mrn: p.mrn,
    nationalIdMasked: maskNationalId(p.nationalId),
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString() : null,
    sex: p.sex,
  }
  return JSON.stringify(snap)
}

function contentSnapshotOf(enc: DocContext): string {
  const note = enc.note!
  const content: SummaryDocContentDTO = {
    openedAt: enc.openedAt.toISOString(),
    closedAt: enc.closedAt ? enc.closedAt.toISOString() : null,
    encounterStatus: enc.status,
    noteStatus: note.status,
    noteVersion: note.versionNumber,
    note: {
      subjective: note.subjective,
      allergiesNote: note.allergiesNote,
      objective: note.objective,
      supportingExam: note.supportingExam,
      assessment: note.assessment,
      plan: note.plan,
      medsGiven: note.medsGiven,
      otherServices: note.otherServices,
      education: note.education,
      followUpPlan: note.followUpPlan,
    },
    diagnoses: note.diagnoses.map((d) => ({
      code: d.icd10.code,
      description: d.icd10.description,
      isPrimary: d.isPrimary,
      noteText: d.noteText,
    })),
    procedures: note.procedures.map((p) => ({
      code: p.icd9Cm.code,
      description: p.icd9Cm.description,
      noteText: p.noteText,
    })),
    prescriptions: note.prescriptions.map((rx) => ({
      number: rx.number,
      status: rx.status,
      items: rx.items.map((it) => ({
        drugName: it.drugName,
        dose: it.dose,
        route: it.route,
        frequency: it.frequency,
        durationDays: it.durationDays,
        quantity: it.quantity,
        instructions: it.instructions,
      })),
    })),
    authorName: note.author.fullName,
    authorProfession: note.authorProfession,
    authorStrNumber: note.authorStrNumber,
  }
  return JSON.stringify(content)
}

// ------------------------------------------------------------
// Terbitkan dokumen dari catatan TERKUNCI
// ------------------------------------------------------------

export async function issueDocumentAction(
  encounterId: string,
  input: SummaryDocIssueInputDTO
): Promise<SummaryDocIssueResult> {
  const guard = await requireReadyContext('dokumen.terbitkan')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const kind = (input.kind ?? '').trim() as SummaryDocKind
  if (!KINDS.includes(kind))
    return { ok: false, error: 'Jenis dokumen tidak dikenal.' }

  const purpose = cleanText(input.purpose)
  if (!purpose)
    return { ok: false, error: 'Keperluan pemberian dokumen wajib diisi.' }

  const relation = (input.recipientRelation ?? 'PASIEN').trim().toUpperCase()
  if (!RELATIONS.includes(relation as (typeof RELATIONS)[number]))
    return { ok: false, error: 'Hubungan penerima tidak dikenal.' }
  const recipientName = cleanText(input.recipientName ?? null)
  if (relation !== 'PASIEN' && !recipientName)
    return { ok: false, error: 'Nama penerima wajib diisi bila penerima bukan pasien.' }

  const enc = await loadDocContext(orgId, encounterId)
  if (!enc) return { ok: false, error: 'Kunjungan tidak ditemukan di praktik ini.' }
  const note = enc.note
  if (!note) return { ok: false, error: 'Catatan belum dibuat pada kunjungan ini.' }
  if (note.status !== 'TERKUNCI')
    return { ok: false, error: 'Dokumen hanya dapat diterbitkan dari catatan yang sudah TERKUNCI.' }
  if (ctx.role === 'PPA' && note.authorUserId !== meId)
    return { ok: false, error: 'PPA hanya menerbitkan dokumen dari catatan yang ditulisnya sendiri.' }

  // Snapshot dibuat SEBELUM penomoran — isi tetap konsisten bila gagal.
  const patientSnapshot = patientSnapshotOf(enc.patient)
  const contentSnapshot = contentSnapshotOf(enc)

  // Nomor unik per praktik — increment atomik (pola MRN/RESEP).
  const isRingkasan = kind === 'RINGKASAN_PELAYANAN'
  const org = await db.organization.update({
    where: { id: orgId },
    data: isRingkasan ? { summaryCounter: { increment: 1 } } : { copyCounter: { increment: 1 } },
    select: { summaryCounter: true, copyCounter: true },
  })
  const seq = isRingkasan ? org.summaryCounter : org.copyCounter
  const number = `${isRingkasan ? 'RINGKASAN' : 'SALINAN'}-${String(seq).padStart(4, '0')}`

  const doc = await db.summaryDocument.create({
    data: {
      organizationId: orgId,
      noteId: note.id,
      patientId: enc.patientId,
      kind,
      number,
      purpose,
      recipientRelation: relation,
      recipientName: relation === 'PASIEN' ? null : recipientName,
      patientSnapshot,
      contentSnapshot,
      issuedByUserId: meId,
    },
  })

  const meta = await clientMeta()
  const penerima =
    relation === 'PASIEN'
      ? 'pasien'
      : `${relation.toLowerCase()} (${recipientName})`
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: meId,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'DOKUMEN_DITERBITKAN',
    objectType: 'SummaryDocument',
    objectId: doc.id,
    summary: `${describeKind(kind)} ${number} diterbitkan untuk ${enc.patient.fullName} (${enc.patient.mrn}) — penerima: ${penerima}. Keperluan: ${purpose}`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })

  return {
    ok: true,
    message: `${describeKind(kind)} ${number} diterbitkan.`,
    documentId: doc.id,
    number,
  }
}

// ------------------------------------------------------------
// Daftar dokumen (metadata) — seluruh praktik / satu catatan
// ------------------------------------------------------------

function toRow(
  d: {
    id: string
    kind: string
    number: string
    purpose: string
    recipientRelation: string
    recipientName: string | null
    issuedByUserId: string
    issuedAt: Date
    note: { encounterId: string } | null
    patient: { fullName: string; mrn: string }
    issuedBy: { fullName: string }
  },
  meId: string
): SummaryDocRowDTO {
  return {
    id: d.id,
    encounterId: d.note?.encounterId ?? '',
    kind: d.kind as SummaryDocKind,
    number: d.number,
    patientName: d.patient.fullName,
    mrn: d.patient.mrn,
    purpose: d.purpose,
    recipientRelation: d.recipientRelation,
    recipientName: d.recipientName,
    issuedByName: d.issuedBy.fullName,
    issuedAt: d.issuedAt.toISOString(),
    isIssuer: d.issuedByUserId === meId,
  }
}

export async function listDocumentsAction(): Promise<SummaryDocRowDTO[] | null> {
  const guard = await requireReadyContext('dokumen.lihat')
  if (!guard.ok) return null
  const ctx = guard.state.context
  const meId = guard.state.me.id

  const rows = await db.summaryDocument.findMany({
    where: { organizationId: ctx.organization.id },
    include: {
      patient: { select: { fullName: true, mrn: true } },
      issuedBy: { select: { fullName: true } },
      note: { select: { encounterId: true } },
    },
    orderBy: { issuedAt: 'desc' },
    take: 200,
  })
  return rows.map((d) => toRow(d, meId))
}

export async function listDocumentsForNoteAction(
  encounterId: string
): Promise<SummaryDocRowDTO[] | null> {
  const guard = await requireReadyContext('dokumen.lihat')
  if (!guard.ok) return null
  const ctx = guard.state.context
  const meId = guard.state.me.id

  const enc = await db.encounter.findFirst({
    where: { id: encounterId, organizationId: ctx.organization.id },
    select: { id: true },
  })
  if (!enc) return []

  const rows = await db.summaryDocument.findMany({
    where: { organizationId: ctx.organization.id, note: { encounterId } },
    include: {
      patient: { select: { fullName: true, mrn: true } },
      issuedBy: { select: { fullName: true } },
      note: { select: { encounterId: true } },
    },
    orderBy: { issuedAt: 'desc' },
  })
  return rows.map((d) => toRow(d, meId))
}

// ------------------------------------------------------------
// Ambil isi dokumen untuk halaman cetak (diaudit bila non-penerbit)
// ------------------------------------------------------------

export async function getDocumentForPrintAction(
  documentId: string
): Promise<SummaryDocDetailDTO | null> {
  const guard = await requireReadyContext('dokumen.lihat')
  if (!guard.ok) return null
  const ctx = guard.state.context
  const meId = guard.state.me.id

  const doc = await db.summaryDocument.findFirst({
    where: { id: documentId, organizationId: ctx.organization.id },
    include: {
      patient: true,
      issuedBy: { select: { fullName: true } },
      note: { select: { encounterId: true } },
    },
  })
  if (!doc) return null

  if (doc.issuedByUserId !== meId) {
    const meta = await clientMeta()
    await writeAuditSafe({
      organizationId: ctx.organization.id,
      actorUserId: meId,
      actorName: guard.state.me.fullName,
      actorRole: ctx.role,
      action: 'DOKUMEN_DILIHAT',
      objectType: 'SummaryDocument',
      objectId: doc.id,
      summary: `Dokumen ${doc.number} (${describeKind(doc.kind)}) milik ${doc.patient.fullName} dibuka oleh bukan penerbitnya.`,
      ip: meta.ip,
      userAgent: meta.userAgent,
      sessionId: ctx.membershipId,
    })
  }

  let patient: SummaryDocPatientDTO
  let content: SummaryDocContentDTO
  try {
    patient = JSON.parse(doc.patientSnapshot) as SummaryDocPatientDTO
    content = JSON.parse(doc.contentSnapshot) as SummaryDocContentDTO
  } catch {
    return null
  }

  const org = ctx.organization
  return {
    id: doc.id,
    kind: doc.kind as SummaryDocKind,
    number: doc.number,
    purpose: doc.purpose,
    recipientRelation: doc.recipientRelation,
    recipientName: doc.recipientName,
    issuedByName: doc.issuedBy.fullName,
    issuedAt: doc.issuedAt.toISOString(),
    patient,
    content,
    org: {
      name: org.name,
      letterheadText: org.letterheadText,
      address: org.address,
      city: org.city,
      province: org.province,
      phone: org.phone,
      email: org.email,
      sipNumber: org.sipNumber,
    },
    isIssuer: doc.issuedByUserId === meId,
  }
}
