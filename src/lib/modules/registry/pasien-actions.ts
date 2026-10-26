'use server'

// ============================================================
// MODUL: registry — aksi pasien (Fase 1)
// Aturan kepatuhan: isi rekam medis tidak boleh dihapus. Pasien hanya
// bisa dinonaktifkan dengan alasan; seluruh aksi tercatat di jejak audit.
// Pencarian duplikat wajib sebelum membuat pasien (NIK unik per praktik).
// ============================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { nomorRM } from '@/lib/modules/konstanta'
import { getRequestMeta } from '@/lib/modules/identity_access/session'

export interface AksiState {
  error?: string
  success?: string
  kodePortalBaru?: string
}

const pasienSchema = z.object({
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.').max(120),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, 'NIK harus 16 angka, atau biarkan kosong.')
    .optional()
    .or(z.literal('')),
  dateOfBirth: z.string().trim().optional().or(z.literal('')), // yyyy-mm-dd
  sex: z.enum(['', 'TIDAK_DICATAT', 'LAKI_LAKI', 'PEREMPUAN']),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  bloodType: z.string().trim().max(10).optional().or(z.literal('')),
  allergiesNote: z.string().trim().max(500).optional().or(z.literal('')),
  payerType: z.enum(['UANG_SENDIRI', 'ASURANSI', 'LAINNYA']),
  payerName: z.string().trim().max(120).optional().or(z.literal('')),
})

function ambilDataPasien(formData: FormData) {
  return pasienSchema.safeParse({
    name: formData.get('name'),
    nik: formData.get('nik'),
    dateOfBirth: formData.get('dateOfBirth'),
    sex: formData.get('sex'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    bloodType: formData.get('bloodType'),
    allergiesNote: formData.get('allergiesNote'),
    payerType: formData.get('payerType') || 'UANG_SENDIRI',
    payerName: formData.get('payerName'),
  })
}

function tanggalLahir(nilai: string): Date | null {
  if (!nilai) return null
  const d = new Date(nilai)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function tambahPasien(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('pasien.kelola')
  const parsed = ambilDataPasien(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data belum lengkap.' }
  }
  const data = parsed.data

  // Cegah duplikat NIK pada praktik ini.
  if (data.nik) {
    const duplikat = await db.patient.findFirst({
      where: { organizationId: ctx.organizationId, nik: data.nik },
      select: { id: true, name: true, medicalRecordNumber: true },
    })
    if (duplikat) {
      return {
        error: `NIK sudah terdaftar atas nama ${duplikat.name} (${duplikat.medicalRecordNumber}). Gunakan pasien yang sudah ada untuk menjaga satu pasien satu berkas.`,
      }
    }
  }

  const medicalRecordNumber = await nomorRM(ctx.organizationId)
  const pasien = await db.patient.create({
    data: {
      organizationId: ctx.organizationId,
      medicalRecordNumber,
      name: data.name,
      nik: data.nik || null,
      dateOfBirth: tanggalLahir(data.dateOfBirth ?? ''),
      sex: data.sex === 'LAKI_LAKI' || data.sex === 'PEREMPUAN' ? data.sex : null,
      phone: data.phone || null,
      address: data.address || null,
      bloodType: data.bloodType || null,
      allergiesNote: data.allergiesNote || null,
      payerType: data.payerType,
      payerName: data.payerName || null,
      isSample: ctx.isSample,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'TAMBAH_PASIEN',
    objectType: 'Patient',
    objectId: pasien.id,
    summary: `Pasien baru: ${pasien.name} (${pasien.medicalRecordNumber})`,
    detail: { nomorRM: medicalRecordNumber, adaNIK: Boolean(pasien.nik) },
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return { success: `Pasien terdaftar dengan nomor RM ${medicalRecordNumber}.` }
}

export async function ubahPasien(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('pasien.kelola')
  const patientId = String(formData.get('patientId') ?? '')
  const parsed = ambilDataPasien(formData)
  if (!patientId) return { error: 'Pasien tidak ditemukan.' }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Data belum lengkap.' }
  }
  const data = parsed.data

  const pasien = await db.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId },
  })
  if (!pasien) return { error: 'Pasien tidak ditemukan pada praktik ini.' }

  if (data.nik && data.nik !== pasien.nik) {
    const duplikat = await db.patient.findFirst({
      where: { organizationId: ctx.organizationId, nik: data.nik, id: { not: patientId } },
      select: { name: true, medicalRecordNumber: true },
    })
    if (duplikat) {
      return { error: `NIK sudah dipakai oleh ${duplikat.name} (${duplikat.medicalRecordNumber}).` }
    }
  }

  await db.patient.update({
    where: { id: patientId },
    data: {
      name: data.name,
      nik: data.nik || null,
      dateOfBirth: tanggalLahir(data.dateOfBirth ?? ''),
      sex: data.sex === 'LAKI_LAKI' || data.sex === 'PEREMPUAN' ? data.sex : null,
      phone: data.phone || null,
      address: data.address || null,
      bloodType: data.bloodType || null,
      allergiesNote: data.allergiesNote || null,
      payerType: data.payerType,
      payerName: data.payerName || null,
    },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'UBAH_PASIEN',
    objectType: 'Patient',
    objectId: patientId,
    summary: `Data pasien diperbarui: ${data.name} (${pasien.medicalRecordNumber})`,
    detail: { perubahanNama: pasien.name !== data.name, perubahanNIK: pasien.nik !== (data.nik || null) },
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return { success: 'Data pasien berhasil diperbarui.' }
}

export async function ubahStatusPasien(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('pasien.kelola')
  const patientId = String(formData.get('patientId') ?? '')
  const statusBaru = String(formData.get('status') ?? '')
  const alasan = String(formData.get('reason') ?? '').trim()

  if (!['AKTIF', 'NONAKTIF'].includes(statusBaru)) {
    return { error: 'Status tidak dikenal.' }
  }
  if (statusBaru === 'NONAKTIF' && alasan.length < 5) {
    return { error: 'Nonaktifkan pasien wajib menyertakan alasan (minimal 5 karakter).' }
  }

  const pasien = await db.patient.findFirst({
    where: { id: patientId, organizationId: ctx.organizationId },
  })
  if (!pasien) return { error: 'Pasien tidak ditemukan pada praktik ini.' }

  await db.patient.update({
    where: { id: patientId },
    data: { status: statusBaru, statusNote: statusBaru === 'NONAKTIF' ? alasan : null },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'STATUS_PASIEN',
    objectType: 'Patient',
    objectId: patientId,
    reason: alasan || undefined,
    summary: `Pasien ${pasien.name} (${pasien.medicalRecordNumber}) menjadi ${statusBaru}. Isi rekam medis tidak dihapus.`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return { success: `Status pasien kini ${statusBaru === 'AKTIF' ? 'aktif' : 'nonaktif'}. Riwayat kunjungan tetap tersimpan.` }
}
