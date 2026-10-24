'use server'

// ============================================================
// e-SIMANTRI — Server Actions Fase 1 (Registrasi & Kunjungan)
// Modul registration_encounter.
//
// Aturan:
// - Seluruh query terlingkup organizationId dari sesi server.
// - Pasien tidak dihapus; duplikat dinonaktifkan (isActive).
// - Pendaftaran/kasir tidak pernah menerima isi catatan klinis.
// - Setiap aksi penting menulis jejak audit (append-only).
// ============================================================

import { db } from '@/lib/db'
import { clientMeta, requireReadyContext } from '@/lib/auth'
import { writeAudit, writeAuditSafe } from '@/lib/audit'
import { cleanText } from '@/lib/completeness'
import { PAYER_OPTIONS } from '@/lib/payer'
import type {
  ActionResult,
  EncounterRowDTO,
  PatientDetailDTO,
  PatientRowDTO,
} from '@/lib/dto'

// ------------------------------------------------------------
// Helper
// ------------------------------------------------------------

function maskNationalId(nik: string | null): string | null {
  if (!nik) return null
  const t = nik.trim()
  if (t.length <= 6) return '••••••'
  return `${t.slice(0, 4)}${'•'.repeat(Math.max(t.length - 6, 4))}${t.slice(-2)}`
}

async function audit(input: {
  organizationId: string
  actorUserId: string
  actorName: string
  actorRole: string
  action: string
  objectType: string
  objectId: string | null
  summary: string
  sessionId: string
  ip: string
  userAgent: string | null
}): Promise<void> {
  await writeAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId,
    summary: input.summary,
    ip: input.ip,
    userAgent: input.userAgent,
    sessionId: input.sessionId,
  })
}

// ------------------------------------------------------------
// Pasien
// ------------------------------------------------------------

export async function listPatientsAction(q: string): Promise<PatientRowDTO[] | null> {
  const guard = await requireReadyContext('pasien.lihat')
  if (!guard.ok) return null
  const orgId = guard.state.context.organization.id

  const term = q.trim()
  const where = {
    organizationId: orgId,
    ...(term
      ? {
          OR: [
            { fullName: { contains: term, mode: 'insensitive' as const } },
            { mrn: { contains: term } },
            { nationalId: { contains: term } },
          ],
        }
      : {}),
  }

  const rows = await db.patient.findMany({
    where,
    orderBy: { fullName: 'asc' },
    take: 200,
  })

  const ids = rows.map((r) => r.id)
  const lastEncounters = await db.encounter.findMany({
    where: { patientId: { in: ids } },
    orderBy: { openedAt: 'desc' },
    select: { patientId: true, openedAt: true },
  })
  const lastMap = new Map<string, Date>()
  for (const e of lastEncounters) {
    if (!lastMap.has(e.patientId)) lastMap.set(e.patientId, e.openedAt)
  }

  return rows.map((p) => ({
    id: p.id,
    mrn: p.mrn,
    fullName: p.fullName,
    nationalIdMasked: maskNationalId(p.nationalId),
    dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
    sex: p.sex,
    phone: p.phone,
    payerType: p.payerType,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    lastEncounterAt: lastMap.get(p.id)?.toISOString() ?? null,
  }))
}

export async function getPatientDetailAction(patientId: string): Promise<PatientDetailDTO | null> {
  const guard = await requireReadyContext('pasien.lihat')
  if (!guard.ok) return null
  const orgId = guard.state.context.organization.id

  const p = await db.patient.findFirst({
    where: { id: patientId, organizationId: orgId },
  })
  if (!p) return null

  return {
    id: p.id,
    mrn: p.mrn,
    fullName: p.fullName,
    nationalIdMasked: maskNationalId(p.nationalId),
    nationalId: p.nationalId,
    dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
    sex: p.sex,
    phone: p.phone,
    address: p.address,
    payerType: p.payerType,
    payerNumber: p.payerNumber,
    notes: p.notes,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    lastEncounterAt: null,
    updatedAt: p.updatedAt.toISOString(),
  }
}

export interface PatientInput {
  fullName: string
  nationalId?: string
  dateOfBirth?: string // yyyy-mm-dd
  sex?: string
  phone?: string
  address?: string
  payerType?: string
  payerNumber?: string
  notes?: string
}

function validatePatientInput(input: PatientInput): { ok: true } | { ok: false; error: string } {
  const fullName = (input.fullName ?? '').trim()
  if (!fullName) return { ok: false, error: 'Nama lengkap pasien wajib diisi.' }
  const nik = cleanText(input.nationalId)
  if (nik && !/^\d{16}$/.test(nik))
    return { ok: false, error: 'NIK harus tepat 16 angka, atau dikosongkan bila tidak tersedia.' }
  if (input.dateOfBirth && Number.isNaN(Date.parse(input.dateOfBirth)))
    return { ok: false, error: 'Tanggal lahir tidak valid.' }
  if (input.sex && !['LAKI_LAKI', 'PEREMPUAN'].includes(input.sex))
    return { ok: false, error: 'Jenis kelamin tidak dikenal.' }
  const payer = input.payerType ?? 'UMUM'
  if (!PAYER_OPTIONS.some((p) => p.value === payer))
    return { ok: false, error: 'Jenis penjamin tidak dikenal.' }
  return { ok: true }
}

function patientData(input: PatientInput) {
  return {
    fullName: input.fullName.trim(),
    nationalId: cleanText(input.nationalId),
    dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    sex: cleanText(input.sex),
    phone: cleanText(input.phone),
    address: cleanText(input.address),
    payerType: input.payerType ?? 'UMUM',
    payerNumber: cleanText(input.payerNumber),
    notes: cleanText(input.notes),
  }
}

export async function createPatientAction(input: PatientInput): Promise<ActionResult> {
  const guard = await requireReadyContext('pasien.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id

  const valid = validatePatientInput(input)
  if (!valid.ok) return { ok: false, error: valid.error }

  // NIK identik di praktik ini dianggap indikasi pasien ganda.
  const nik = cleanText(input.nationalId)
  if (nik) {
    const dup = await db.patient.findFirst({ where: { organizationId: orgId, nationalId: nik } })
    if (dup)
      return {
        ok: false,
        error: `Sudah ada pasien dengan NIK yang sama: ${dup.fullName} (${dup.mrn}). Gunakan pasien yang sudah terdaftar; pasien tidak dapat dihapus.`,
      }
  }

  // Nomor rekam medis berurutan per praktik — increment atomik.
  const org = await db.organization.update({
    where: { id: orgId },
    data: { mrnCounter: { increment: 1 } },
    select: { mrnCounter: true },
  })
  const mrn = `RM-${String(org.mrnCounter).padStart(4, '0')}`

  const patient = await db.patient.create({
    data: {
      organizationId: orgId,
      mrn,
      createdByUserId: guard.state.me.id,
      ...patientData(input),
    },
  })

  const meta = await clientMeta()
  await audit({
    organizationId: orgId,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'PASIEN_DIDAFTARKAN',
    objectType: 'Patient',
    objectId: patient.id,
    summary: `Pasien baru didaftarkan: ${patient.fullName} (${patient.mrn}).`,
    sessionId: ctx.membershipId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return { ok: true, message: `Pasien terdaftar dengan nomor rekam medis ${patient.mrn}.` }
}

export async function updatePatientAction(
  patientId: string,
  input: PatientInput
): Promise<ActionResult> {
  const guard = await requireReadyContext('pasien.kelola')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id

  const valid = validatePatientInput(input)
  if (!valid.ok) return { ok: false, error: valid.error }

  const existing = await db.patient.findFirst({ where: { id: patientId, organizationId: orgId } })
  if (!existing) return { ok: false, error: 'Pasien tidak ditemukan di praktik ini.' }

  const nik = cleanText(input.nationalId)
  if (nik && nik !== existing.nationalId) {
    const dup = await db.patient.findFirst({
      where: { organizationId: orgId, nationalId: nik, id: { not: patientId } },
    })
    if (dup)
      return {
        ok: false,
        error: `NIK sudah dipakai pasien lain: ${dup.fullName} (${dup.mrn}).`,
      }
  }

  await db.patient.update({ where: { id: patientId }, data: patientData(input) })

  const meta = await clientMeta()
  await audit({
    organizationId: orgId,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'DATA_PASIEN_DIUBAH',
    objectType: 'Patient',
    objectId: patientId,
    summary: `Data identitas pasien diperbarui: ${existing.fullName} (${existing.mrn}).`,
    sessionId: ctx.membershipId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return { ok: true, message: 'Data pasien tersimpan.' }
}

// ------------------------------------------------------------
// Kunjungan
// ------------------------------------------------------------

export async function listEncountersAction(
  scope: 'HARI_INI' | 'RIWAYAT'
): Promise<EncounterRowDTO[] | null> {
  const guard = await requireReadyContext('kunjungan.lihat')
  if (!guard.ok) return null
  const orgId = guard.state.context.organization.id

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const rows = await db.encounter.findMany({
    where: {
      organizationId: orgId,
      ...(scope === 'HARI_INI'
        ? { openedAt: { gte: startOfToday } }
        : {}),
    },
    include: {
      patient: { select: { fullName: true, mrn: true } },
      note: {
        select: { status: true, authorUserId: true, author: { select: { fullName: true } } },
      },
    },
    orderBy: { openedAt: 'desc' },
    take: scope === 'HARI_INI' ? 100 : 200,
  })

  const meId = guard.state.me.id
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
    canOpenNote:
      e.note?.authorUserId === meId || (!e.note && guard.state.context.role === 'PPA'),
  }))
}

export async function openEncounterAction(
  patientId: string,
  payerType?: string,
  payerNumber?: string
): Promise<ActionResult & { encounterId?: string }> {
  const guard = await requireReadyContext('kunjungan.buka')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id

  const patient = await db.patient.findFirst({
    where: { id: patientId, organizationId: orgId },
    select: { id: true, fullName: true, mrn: true, isActive: true },
  })
  if (!patient) return { ok: false, error: 'Pasien tidak ditemukan di praktik ini.' }
  if (!patient.isActive)
    return { ok: false, error: 'Pasien berstatus nonaktif. Periksa data pasien terlebih dahulu.' }

  const pt = PAYER_OPTIONS.some((p) => p.value === payerType) ? payerType! : 'UMUM'
  const open = await db.encounter.create({
    data: {
      organizationId: orgId,
      patientId: patient.id,
      registeredByUserId: guard.state.me.id,
      payerType: pt,
      payerNumber: cleanText(payerNumber),
    },
  })

  const meta = await clientMeta()
  await audit({
    organizationId: orgId,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'KUNJUNGAN_DIBUKA',
    objectType: 'Encounter',
    objectId: open.id,
    summary: `Kunjungan dibuka untuk ${patient.fullName} (${patient.mrn}).`,
    sessionId: ctx.membershipId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return { ok: true, message: 'Kunjungan dibuka.', encounterId: open.id }
}

export async function closeEncounterAction(
  encounterId: string,
  reason?: string
): Promise<ActionResult> {
  const guard = await requireReadyContext('kunjungan.tutup')
  if (!guard.ok) return { ok: false, error: guard.error }
  const ctx = guard.state.context
  const orgId = ctx.organization.id

  const enc = await db.encounter.findFirst({
    where: { id: encounterId, organizationId: orgId },
    include: { patient: { select: { fullName: true, mrn: true } }, note: true },
  })
  if (!enc) return { ok: false, error: 'Kunjungan tidak ditemukan di praktik ini.' }
  if (enc.status === 'SELESAI') return { ok: false, error: 'Kunjungan sudah ditutup.' }
  if (enc.note?.status === 'TERKUNCI')
    return { ok: false, error: 'Kunjungan dengan catatan terkunci ditutup otomatis saat penguncian.' }

  const reasonText = cleanText(reason)
  await db.encounter.update({
    where: { id: encounterId },
    data: { status: 'SELESAI', closedAt: new Date(), closeReason: reasonText },
  })

  const meta = await clientMeta()
  await audit({
    organizationId: orgId,
    actorUserId: guard.state.me.id,
    actorName: guard.state.me.fullName,
    actorRole: ctx.role,
    action: 'KUNJUNGAN_DITUTUP',
    objectType: 'Encounter',
    objectId: encounterId,
    summary: `Kunjungan ${enc.patient.fullName} (${enc.patient.mrn}) ditutup tanpa catatan terkunci${
      reasonText ? ` — alasan: ${reasonText}` : ''
    }.`,
    ip: meta.ip,
    userAgent: meta.userAgent,
    sessionId: ctx.membershipId,
  })

  return {
    ok: true,
    message:
      'Kunjungan ditutup. Kunjungan tanpa catatan terkunci akan muncul pada dasbor kelengkapan.',
  }
}
