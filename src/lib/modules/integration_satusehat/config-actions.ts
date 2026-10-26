'use server'

// ============================================================
// MODUL: integration_satusehat — konfigurasi per praktik (Fase 5)
// Default SIMULASI & nonaktif. Praktik harus sadar mengaktifkan.
// Tidak ada klaim koneksi produksi di mana pun pada aplikasi ini.
// ============================================================

import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { requirePermission } from '@/lib/modules/tenant/context'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import { prosesAntrean } from './outbox'

export interface AksiState {
  error?: string
  success?: string
  ringkas?: { diproses: number; berhasil: number; gagal: number }
}

export async function simpanKonfigurasiSatusehat(_prev: AksiState, formData: FormData): Promise<AksiState> {
  const ctx = await requirePermission('satusehat.kelola')
  const mode = String(formData.get('mode') ?? 'SIMULASI') === 'SANDBOX' ? 'SANDBOX' : 'SIMULASI'
  const enabled = formData.get('enabled') === 'ya'
  const baseUrl = String(formData.get('baseUrl') ?? '').trim() || null
  const clientId = String(formData.get('clientId') ?? '').trim() || null
  const clientSecret = String(formData.get('clientSecret') ?? '').trim() || null
  const locationRefId = String(formData.get('locationRefId') ?? '').trim() || null

  if (mode === 'SANDBOX' && !baseUrl) {
    return { error: 'Mode sandbox memerlukan alamat (URL) sandbox yang valid.' }
  }
  if (mode === 'SANDBOX' && !/^https:\/\//.test(baseUrl ?? '')) {
    return { error: 'Alamat sandbox harus menggunakan https.' }
  }

  const data = {
    mode: mode as string,
    enabled: enabled as boolean,
    baseUrl,
    clientId,
    // Hanya perbarui secret bila diisi ulang (tidak lewat GET/perenderan).
    ...(clientSecret ? { clientSecret } : {}),
    locationRefId,
  }

  await db.satusehatConfig.upsert({
    where: { organizationId: ctx.organizationId },
    update: data,
    create: { organizationId: ctx.organizationId, ...data },
  })

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'SATUSEHAT_KONFIG',
    objectType: 'SatusehatConfig',
    summary: `Konfigurasi SATUSEHAT diubah: mode ${mode}, integrasi ${enabled ? 'aktif' : 'nonaktif'}`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  return { success: `Konfigurasi tersimpan. Mode: ${mode}, integrasi ${enabled ? 'AKTIF' : 'nonaktif'}.` }
}

export async function prosesAntreanSekarang(): Promise<AksiState> {
  const ctx = await requirePermission('satusehat.kelola')
  const hasil = await prosesAntrean(ctx.organizationId, ctx.auth.fullName)
  if (hasil.diproses === 0) {
    return { success: 'Tidak ada kejadian dalam antrean. Pastikan integrasi aktif dan ada kunjungan terkunci.' }
  }
  return {
    success: `${hasil.diproses} kejadian diproses: ${hasil.berhasil} berhasil, ${hasil.gagal} gagal.`,
    ringkas: hasil,
  }
}

export async function cobaUlangKejadian(formData: FormData): Promise<void> {
  const ctx = await requirePermission('satusehat.kelola')
  const eventId = String(formData.get('eventId') ?? '')
  const kejadian = await db.outboxEvent.findFirst({
    where: { id: eventId, organizationId: ctx.organizationId, status: { in: ['GAGAL_KIRIM'] } },
  })
  if (!kejadian) return
  await db.outboxEvent.update({ where: { id: kejadian.id }, data: { status: 'ANTRE' } })
  await prosesAntrean(ctx.organizationId, ctx.auth.fullName)
}
