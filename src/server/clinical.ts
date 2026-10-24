'use server'

// ============================================================
// e-SIMANTRI — Server Actions Fase 2 (Catatan Klinis Dokter Umum)
// Modul clinical_note_dokter.
//
// Aturan keras (master prompt + PMK 24/2022):
// - TIDAK ADA fungsi hapus catatan klinis.
// - Draf hanya dapat dibuat/diubah/dikunci oleh PPA penulisnya.
// - Penguncian ditolak bila bagian wajib PMK belum lengkap.
// - Catatan terkunci dikoreksi lewat amandemen dengan ALASAN
//   wajib; isi versi sebelumnya dipertahankan (append-only).
// - Membuka isi catatan oleh pihak selain penulis selalu diaudit.
// - Penanggung Jawab tidak otomatis membaca isi klinis.
// - Seluruh query terlingkup praktik aktif dari sesi server.
// ============================================================

import { db } from '@/lib/db'
import { clientMeta, requireReadyContext } from '@/lib/auth'
import { writeAudit, writeAuditSafe } from '@/lib/audit'
import { checkCompleteness, cleanText } from '@/lib/completeness'
import type {
  ActionResult,
  CompletenessDashboardDTO,
  CompletenessRowDTO,
  EncounterRowDTO,
  NoteContentDTO,
  NoteDetailDTO,
  NoteVersionDetailDTO,
  NoteVersionRowDTO,
} from '@/lib/dto'

// ------------------------------------------------------------
// Helper
// ------------------------------------------------------------

type NoteInput = NoteContentDTO

function normalizeContent(input: NoteInput): NoteContentDTO {
  return {
    subjective: cleanText(input.subjective),
    allergiesNote: cleanText(input.allergiesNote),
    objective: cleanText(input.objective),
    supportingExam: cleanText(input.supportingExam),
    assessment: cleanText(input.assessment),
    plan: cleanText(input.plan),
    medsGiven: cleanText(input.medsGiven),
    otherServices: cleanText(input.otherServices),
    education: cleanText(input.education),
    followUpPlan: cleanText(input.followUpPlan),
  }
}

function contentRow(note: {
  subjective: string | null
  allergiesNote: string | null
  objective: string | null
  supportingExam: string | null
  assessment: string | null
  plan: string | null
  medsGiven: string | null
  otherServices: string | null
  education: string | null
  followUpPlan: string | null
}): NoteContentDTO {
  return {
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
  }
}

async function loadEncounter(orgId: string, encounterId: string) {
  return db.encounter.findFirst({
    where: { id: encounterId, organizationId: orgId },
    include: {
      patient: { select: { id: true, fullName: true, mrn: true, sex: true, dateOfBirth: true } },
      note: { include: { author: { select: { fullName: true } } } },
    },
  })
}

// ------------------------------------------------------------
// Daftar kerja catatan (metadata — tanpa isi klinis)
// ------------------------------------------------------------

export async function listEncountersForNoteAction(
  scope: 'PERLU_DOKUMENTASI' | 'CATATAN_SAYA'
): Promise<EncounterRowDTO[] | null> {
  const guard = await requireReadyContext('catatan.klinis.lihat')
  if (!guard.ok) return null
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const rows = await db.encounter.findMany({
    where: {
      organizationId: orgId,
      ...(scope === 'PERLU_DOKUMENTASI'
        ? {
            OR: [{ note: null }, { note: { status: 'DRAF' } }],
          }
        : { note: { authorUserId: meId } }),
    },
    include: {
      patient: { select: { fullName: true, mrn: true } },
      note: {
        select: { status: true, authorUserId: true, author: { select: { fullName: true } } },
      },
    },
    orderBy: { openedAt: 'desc' },
    take: 100,
  })

  return rows.map((e) => ({
    id: e.id,
    patientId: e.patientId,
    patientName: e.patient.fullName,
    mrn: e.patient.mrn,
    status: e.status,
    openedAt: e.openedAt.toISOString(),
    closedAt: e.closedAt?.toISOString() ?? null,
    payerType: e.payerType,
    closeReason: e.closeReason,
    noteStatus: !e.note ? 'BELUM_ADA' : e.note.status === 'TERKUNCI' ? 'TERKUNCI' : 'DRAF',
    noteAuthorName: e.note?.author.fullName ?? null,
    isMine: e.note?.authorUserId === meId,
    canOpenNote: scope === 'PERLU_DOKUMENTASI' ? ctx.role === 'PPA' : true,
  }))
}

// ------------------------------------------------------------
// Buka isi catatan — akses non-penulis selalu diaudit
// ------------------------------------------------------------

export async function getNoteAction(encounterId: string): Promise<NoteDetailDTO | null> {
  const guard = await requireReadyContext('catatan.klinis.lihat')
  if (!guard.ok) return null
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const enc = await loadEncounter(orgId, encounterId)
  if (!enc) return null
  const note = enc.note
  if (!note) return null

  const isAuthor = note.authorUserId === meId

  if (!isAuthor) {
    const meta = await clientMeta()
    await writeAuditSafe({
      organizationId: orgId,
      actorUserId: meId,
      actorName: guard.state.me.fullName,
      actorRole: ctx.role,
      action: 'CATATAN_DILIHAT',
      objectType: 'ClinicalNote',
      objectId: note.id,
      summary: `Membuka catatan klinis ${enc.patient.fullName} (${enc.patient.mrn}) karya ${note.author?.fullName ?? 'PPA lain'} — akses bukan penulis, tercatat otomatis.`,
      ip: meta.ip,
      userAgent: meta.userAgent,
      sessionId: ctx.membershipId,
    })
  }

  const author = await db.user.findUnique({
    where: { id: note.authorUserId },
    select: { fullName: true },
  })
  const completeness = checkCompleteness(contentRow(note))

  return {
    id: note.id,
    encounterId: enc.id,
    status: note.status,
    versionNumber: note.versionNumber,
    authorUserId: note.authorUserId,
    authorName: author?.fullName ?? 'PPA',
    authorProfession: note.authorProfession,
    authorStrNumber: note.authorStrNumber,
    lockedAt: note.lockedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    ...contentRow(note),
    patientName: enc.patient.fullName,
    mrn: enc.patient.mrn,
    patientSex: enc.patient.sex,
    patientDateOfBirth: enc.patient.dateOfBirth?.toISOString() ?? null,
    openedAt: enc.openedAt.toISOString(),
    isAuthor,
    completeness,
  }
}

// ------------------------------------------------------------
// Simpan draf — hanya penulis
// ------------------------------------------------------------

export async function saveDraftNoteAction(
  encounterId: string,
  input: NoteInput
): Promise<ActionResult> {
  const guard = await requireReadyContext('catatan.klinis.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const enc = await loadEncounter(orgId, encounterId)
  if (!enc) return { ok: false, error: 'Kunjungan tidak ditemukan di praktik ini.' }

  const content = normalizeContent(input)

  if (!enc.note) {
    // PPA pemegang izin kelola mendokumentasikan kunjungan ini.
    const note = await db.clinicalNote.create({
      data: {
        organizationId: orgId,
        encounterId: enc.id,
        patientId: enc.patientId,
        authorUserId: meId,
        status: 'DRAF',
        versionNumber: 1,
        ...content,
      },
    })
    const meta = await clientMeta()
    await writeAuditSafe({
      organizationId: orgId,
      actorUserId: meId,
      actorName: guard.state.me.fullName,
      actorRole: ctx.role,
      action: 'CATATAN_DIBUAT',
      objectType: 'ClinicalNote',
      objectId: note.id,
      summary: `Draf catatan klinis dibuat untuk ${enc.patient.fullName} (${enc.patient.mrn}).`,
      ip: meta.ip,
      userAgent: meta.userAgent,
      sessionId: ctx.membershipId,
    })
    return { ok: true, message: 'Draf catatan dibuat.' }
  }

  const note = enc.note
  if (note.status === 'TERKUNCI')
    return { ok: false, error: 'Catatan sudah terkunci. Gunakan alur amandemen dengan alasan.' }
  if (note.authorUserId !== meId)
    return { ok: false, error: 'Hanya penulis draf yang dapat mengubahnya.' }

  await db.clinicalNote.update({ where: { id: note.id }, data: content })

  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: meId,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'CATATAN_DISEMPAN',
    objectType: 'ClinicalNote',
    objectId: note.id,
    summary: `Draf catatan klinis ${enc.patient.fullName} (${enc.patient.mrn}) disimpan.`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })
  return { ok: true, message: 'Draf catatan disimpan.' }
}

// ------------------------------------------------------------
// Kunci catatan — wajib lengkap PMK, hanya penulis
// ------------------------------------------------------------

export async function lockNoteAction(
  encounterId: string,
  input?: NoteInput
): Promise<ActionResult> {
  const guard = await requireReadyContext('catatan.klinis.kunci')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const enc = await loadEncounter(orgId, encounterId)
  if (!enc) return { ok: false, error: 'Kunjungan tidak ditemukan di praktik ini.' }

  let note = enc.note
  if (!note) {
    // Kunci langsung dari formulir: simpan sebagai draf milik penulis dahulu.
    const created = await db.clinicalNote.create({
      data: {
        organizationId: orgId,
        encounterId: enc.id,
        patientId: enc.patientId,
        authorUserId: meId,
        status: 'DRAF',
        versionNumber: 1,
        ...normalizeContent(input ?? ({} as NoteInput)),
      },
    })
    note = await db.clinicalNote.findUniqueOrThrow({
      where: { id: created.id },
      include: { author: { select: { fullName: true } } },
    })
  }
  if (note.authorUserId !== meId)
    return { ok: false, error: 'Hanya PPA penulis catatan yang dapat menguncinya.' }
  if (note.status === 'TERKUNCI') return { ok: false, error: 'Catatan sudah terkunci.' }

  // Bila formulir dikirim bersamaan dengan penguncian, simpan isinya dulu.
  if (input) {
    await db.clinicalNote.update({ where: { id: note.id }, data: normalizeContent(input) })
    note = await db.clinicalNote.findUniqueOrThrow({
      where: { id: note.id },
      include: { author: { select: { fullName: true } } },
    })
  }

  const content = contentRow(note)
  const completeness = checkCompleteness(content)
  if (!completeness.ready) {
    return {
      ok: false,
      error: `Catatan belum lengkap sesuai isi minimum PMK 24/2022: ${completeness.missing
        .map((m) => m.label)
        .join('; ')}.`,
    }
  }

  const me = await db.user.findUnique({
    where: { id: meId },
    select: { profession: true, strNumber: true },
  })
  if (!me?.profession || !me?.strNumber) {
    return {
      ok: false,
      error:
        'Profesi dan nomor STR Anda belum lengkap pada profil akun. Lengkapi sebelum mengunci catatan.',
    }
  }

  const now = new Date()
  const encounterWasOpen = enc.status === 'DALAM_PROSES'

  await db.$transaction([
    db.clinicalNote.update({
      where: { id: note.id },
      data: {
        ...content,
        status: 'TERKUNCI',
        lockedAt: now,
        lockedByUserId: meId,
        authorProfession: me.profession,
        authorStrNumber: me.strNumber,
      },
    }),
    ...(encounterWasOpen
      ? [
          db.encounter.update({
            where: { id: enc.id },
            data: { status: 'SELESAI', closedAt: now, closeReason: null },
          }),
        ]
      : []),
  ])

  const meta = await clientMeta()
  await writeAudit({
    organizationId: orgId,
    actorUserId: meId,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'CATATAN_DIKUNCI',
    objectType: 'ClinicalNote',
    objectId: note.id,
    summary: `Catatan klinis ${enc.patient.fullName} (${enc.patient.mrn}) DIKUNCI (versi 1)${
      encounterWasOpen ? '; kunjungan ditutup otomatis.' : ''
    }.`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })

  return {
    ok: true,
    message: encounterWasOpen
      ? 'Catatan dikunci dan kunjungan ditutup. Catatan terkunci hanya dapat dikoreksi lewat amandemen.'
      : 'Catatan dikunci. Catatan terkunci hanya dapat dikoreksi lewat amandemen.',
  }
}

// ------------------------------------------------------------
// Amandemen catatan terkunci — alasan wajib, versi dipertahankan
// ------------------------------------------------------------

export async function amendNoteAction(
  encounterId: string,
  input: NoteInput,
  reason: string
): Promise<ActionResult> {
  const guard = await requireReadyContext('catatan.klinis.revisi')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id
  const meId = guard.state.me.id

  const reasonText = cleanText(reason)
  if (!reasonText) return { ok: false, error: 'Alasan amandemen wajib diisi.' }

  const enc = await loadEncounter(orgId, encounterId)
  if (!enc || !enc.note) return { ok: false, error: 'Catatan tidak ditemukan.' }
  const note = enc.note
  if (note.status !== 'TERKUNCI')
    return { ok: false, error: 'Catatan masih draf; ubah langsung tanpa amandemen.' }
  if (note.authorUserId !== meId)
    return { ok: false, error: 'Amandemen hanya oleh PPA penulis catatan.' }

  const content = normalizeContent(input)
  const completeness = checkCompleteness(content)
  if (!completeness.ready) {
    return {
      ok: false,
      error: `Isi hasil amandemen belum lengkap: ${completeness.missing
        .map((m) => m.label)
        .join('; ')}.`,
    }
  }

  const previous = contentRow(note)
  const previousVersionNumber = note.versionNumber

  await db.$transaction([
    db.clinicalNoteVersion.create({
      data: {
        noteId: note.id,
        versionNumber: previousVersionNumber,
        ...previous,
        status: note.status,
        reason: reasonText,
        changedByUserId: meId,
        changedByName: guard.state.me.fullName,
      },
    }),
    db.clinicalNote.update({
      where: { id: note.id },
      data: { ...content, versionNumber: previousVersionNumber + 1 },
    }),
  ])

  const meta = await clientMeta()
  await writeAudit({
    organizationId: orgId,
    actorUserId: meId,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'CATATAN_DIAMANDEMEN',
    objectType: 'ClinicalNote',
    objectId: note.id,
    summary: `Catatan klinis ${enc.patient.fullName} (${enc.patient.mrn}) diamandemen dari versi ${previousVersionNumber} ke ${previousVersionNumber + 1}. Alasan: ${reasonText}`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })

  return {
    ok: true,
    message: `Amandemen tersimpan — versi ${previousVersionNumber + 1}. Versi sebelumnya dipertahankan.`,
  }
}

// ------------------------------------------------------------
// Riwayat versi
// ------------------------------------------------------------

export async function listNoteVersionsAction(
  encounterId: string
): Promise<NoteVersionRowDTO[] | null> {
  const guard = await requireReadyContext('catatan.klinis.lihat')
  if (!guard.ok) return null
  const orgId = guard.state.context.organization.id

  const enc = await loadEncounter(orgId, encounterId)
  if (!enc?.note) return null

  const rows = await db.clinicalNoteVersion.findMany({
    where: { noteId: enc.note.id },
    orderBy: { versionNumber: 'desc' },
  })

  return rows.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    reason: v.reason,
    changedByName: v.changedByName,
    createdAt: v.createdAt.toISOString(),
  }))
}

export async function getNoteVersionDetailAction(
  encounterId: string,
  versionNumber: number
): Promise<NoteVersionDetailDTO | null> {
  const guard = await requireReadyContext('catatan.klinis.lihat')
  if (!guard.ok) return null
  const ctx = guard.state.context
  const orgId = guard.state.context.organization.id

  const enc = await loadEncounter(orgId, encounterId)
  if (!enc?.note) return null

  const v = await db.clinicalNoteVersion.findUnique({
    where: { noteId_versionNumber: { noteId: enc.note.id, versionNumber } },
  })
  if (!v) return null

  const meta = await clientMeta()
  await writeAuditSafe({
    organizationId: orgId,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'VERSI_CATATAN_DILIHAT',
    objectType: 'ClinicalNoteVersion',
    objectId: v.id,
    summary: `Melihat versi ${v.versionNumber} catatan klinis ${enc.patient.fullName} (${enc.patient.mrn}).`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })

  return {
    id: v.id,
    versionNumber: v.versionNumber,
    reason: v.reason,
    changedByName: v.changedByName,
    createdAt: v.createdAt.toISOString(),
    status: v.status,
    content: {
      subjective: v.subjective,
      allergiesNote: v.allergiesNote,
      objective: v.objective,
      supportingExam: v.supportingExam,
      assessment: v.assessment,
      plan: v.plan,
      medsGiven: v.medsGiven,
      otherServices: v.otherServices,
      education: v.education,
      followUpPlan: v.followUpPlan,
    },
  }
}

// ------------------------------------------------------------
// Dasbor kelengkapan — metadata saja, tanpa isi klinis
// ------------------------------------------------------------

export async function completenessDashboardAction(): Promise<CompletenessDashboardDTO | null> {
  const guard = await requireReadyContext('kelengkapan.dasbor.lihat')
  if (!guard.ok) return null
  const orgId = guard.state.context.organization.id

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [totalHariIni, dalamProses, catatanDraf, catatanTerkunci, rows] = await Promise.all([
    db.encounter.count({ where: { organizationId: orgId, openedAt: { gte: startOfToday } } }),
    db.encounter.count({ where: { organizationId: orgId, status: 'DALAM_PROSES' } }),
    db.clinicalNote.count({ where: { organizationId: orgId, status: 'DRAF' } }),
    db.clinicalNote.count({ where: { organizationId: orgId, status: 'TERKUNCI' } }),
    db.encounter.findMany({
      where: {
        organizationId: orgId,
        OR: [{ note: null }, { note: { status: 'DRAF' } }],
      },
      include: {
        patient: { select: { fullName: true, mrn: true } },
        note: { select: { status: true, author: { select: { fullName: true } } } },
      },
      orderBy: { openedAt: 'desc' },
      take: 100,
    }),
  ])

  const list: CompletenessRowDTO[] = rows.map((e) => ({
    encounterId: e.id,
    patientName: e.patient.fullName,
    mrn: e.patient.mrn,
    openedAt: e.openedAt.toISOString(),
    status: e.status,
    noteStatus: !e.note ? 'BELUM_ADA' : e.note.status === 'TERKUNCI' ? 'TERKUNCI' : 'DRAF',
    authorName: e.note?.author.fullName ?? null,
    issue: !e.note
      ? e.status === 'SELESAI'
        ? `Kunjungan ditutup tanpa catatan terkunci${e.closeReason ? ` (${e.closeReason})` : ''}.`
        : 'Kunjungan berlangsung; catatan belum dibuat.'
      : `Draf catatan karya ${e.note.author.fullName} belum dikunci.`,
  }))

  return {
    totalHariIni,
    dalamProses,
    catatanDraf,
    catatanTerkunci,
    tanpaCatatanTerkunci: list.length,
    rows: list,
  }
}
