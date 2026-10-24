// ============================================================
// e-SIMANTRI — Modul audit: pencatatan jejak audit (Fase 0)
//
// Aturan (bagian 4 master prompt):
// Setiap buka isi rekam medis, ubah, kunci, buka kunci, cetak,
// ekspor, dan kirim ke SATUSEHAT menulis audit yang tidak bisa
// diubah pengguna: siapa, peran, kapan, dari perangkat/sesi mana,
// objek apa, aksi apa, dan alasan bila aksesnya tidak rutin.
//
// Layanan ini sengaja TIDAK menyediakan fungsi update atau delete.
// ============================================================

import { db } from '@/lib/db'

export interface WriteAuditInput {
  organizationId?: string | null
  actorUserId?: string | null
  actorName?: string | null
  actorRole?: string | null
  action: string
  objectType?: string | null
  objectId?: string | null
  summary: string
  reason?: string | null
  ip?: string | null
  userAgent?: string | null
  sessionId?: string | null
}

export async function writeAudit(input: WriteAuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      objectType: input.objectType ?? null,
      objectId: input.objectId ?? null,
      summary: input.summary,
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      sessionId: input.sessionId ?? null,
    },
  })
}

// Pencatatan audit tidak boleh menggagalkan alur yang sedang berjalan
// ketika kegagalannya bersifat pelengkap (mis. log percobaan login gagal).
// Aksi penting tetap menunggu audit selesai (writeAudit dipanggil langsung).
export async function writeAuditSafe(input: WriteAuditInput): Promise<void> {
  try {
    await writeAudit(input)
  } catch (err) {
    console.error('[audit] gagal menulis jejak audit:', err)
  }
}
