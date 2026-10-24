// ============================================================
// e-SIMANTRI — Tipe data yang lewat batas server → klien (SPA).
// Fase 0: hanya modul identity_access + audit.
// ============================================================

import type { RoleKey } from './roles'

export type AppStatus =
  | { status: 'logged_out' }
  | { status: 'pending_2fa'; email: string }
  | { status: 'no_membership' }
  | { status: 'pick_tenant'; me: MeDTO; memberships: MembershipDTO[] }
  | { status: 'ready'; me: MeDTO; memberships: MembershipDTO[]; context: ContextDTO }

export interface MeDTO {
  id: string
  fullName: string
  email: string
  profession: string | null
  totpEnabled: boolean
}

export interface MembershipDTO {
  id: string
  role: RoleKey
  organizationId: string
  organizationName: string
  organizationStatus: string
}

export interface ContextDTO {
  membershipId: string
  role: RoleKey
  organization: OrganizationDTO
}

export interface OrganizationDTO {
  id: string
  name: string
  practiceType: string
  sipNumber: string | null
  ownerName: string | null
  address: string | null
  city: string | null
  province: string | null
  postalCode: string | null
  phone: string | null
  email: string | null
  letterheadText: string | null
  status: string
  updatedAt: string
}

export interface ActionResult {
  ok: boolean
  error?: string
  message?: string
}

export interface LoginResult extends ActionResult {
  next?: '2fa' | 'tenant' | 'ready' | 'no_membership'
}

export interface UserRowDTO {
  id: string
  fullName: string
  email: string
  profession: string | null
  strNumber: string | null
  isActive: boolean
  totpEnabled: boolean
  createdAt: string
  lastSessionAt: string | null
  roles: { membershipId: string; role: RoleKey; isActive: boolean }[]
}

export interface AuditRowDTO {
  id: string
  createdAt: string
  actorName: string | null
  actorRole: string | null
  action: string
  objectType: string | null
  summary: string
  ip: string | null
  organizationName: string | null
}

export interface SessionRowDTO {
  id: string
  createdAt: string
  lastSeenAt: string
  ip: string | null
  userAgent: string | null
  current: boolean
}

// ============================================================
// Fase 1 — Registrasi & Kunjungan
// ============================================================

export interface PatientRowDTO {
  id: string
  mrn: string
  fullName: string
  nationalIdMasked: string | null
  dateOfBirth: string | null
  sex: string | null
  phone: string | null
  payerType: string
  isActive: boolean
  createdAt: string
  lastEncounterAt: string | null
}

export interface PatientDetailDTO extends PatientRowDTO {
  nationalId: string | null // hanya untuk pemegang izin pasien.lihat
  address: string | null
  payerNumber: string | null
  notes: string | null
  updatedAt: string
}

export interface EncounterRowDTO {
  id: string
  patientId: string
  patientName: string
  mrn: string
  status: string
  openedAt: string
  closedAt: string | null
  payerType: string | null
  closeReason: string | null
  noteStatus: 'BELUM_ADA' | 'DRAF' | 'TERKUNCI'
  noteAuthorName: string | null
  isMine: boolean // kunjungan yang catatannya ditulis oleh pengguna aktif
  canOpenNote: boolean
}

export interface PayerOptionDTO {
  value: string
  label: string
}

// ============================================================
// Fase 2 — Catatan klinis & kelengkapan
// ============================================================

export interface NoteContentDTO {
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
}

export interface NoteDetailDTO extends NoteContentDTO {
  id: string
  encounterId: string
  status: string
  versionNumber: number
  authorUserId: string
  authorName: string
  authorProfession: string | null
  authorStrNumber: string | null
  lockedAt: string | null
  createdAt: string
  updatedAt: string
  // konteks
  patientName: string
  mrn: string
  patientSex: string | null
  patientDateOfBirth: string | null
  openedAt: string
  isAuthor: boolean
  completeness: CompletenessDTO
}

export interface CompletenessDTO {
  ready: boolean
  missing: { field: string; label: string }[]
}

export interface NoteVersionRowDTO {
  id: string
  versionNumber: number
  reason: string
  changedByName: string
  createdAt: string
}

export interface NoteVersionDetailDTO extends NoteVersionRowDTO {
  content: NoteContentDTO
  status: string
}

export interface CompletenessRowDTO {
  encounterId: string
  patientName: string
  mrn: string
  openedAt: string
  status: string
  noteStatus: 'BELUM_ADA' | 'DRAF' | 'TERKUNCI'
  authorName: string | null
  issue: string
}

export interface CompletenessDashboardDTO {
  totalHariIni: number
  dalamProses: number
  catatanDraf: number
  catatanTerkunci: number
  tanpaCatatanTerkunci: number
  rows: CompletenessRowDTO[]
}
