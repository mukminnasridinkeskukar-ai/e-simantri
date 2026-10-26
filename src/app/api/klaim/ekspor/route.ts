// Ekspor data klaim (CSV) — Fase 8. Hanya staf dengan izin klaim.lihat
// pada praktik aktif. Ekspor tercatat di jejak audit (EKSPOR_KLAIM).

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOrg } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { getRequestMeta } from '@/lib/modules/identity_access/session'

function csvNilai(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET() {
  const ctx = await requireOrg()
  if (!hasPermission(ctx.roles, 'klaim.lihat')) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 })
  }

  const daftar = await db.invoice.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    include: { encounter: { include: { patient: true } } },
  })

  const baris: string[] = [
    ['nomor_tagihan', 'status', 'nomor_kunjungan', 'pasien', 'nomor_rm', 'total_rp', 'penjamin', 'metode_bayar', 'waktu_terbit', 'waktu_bayar'].join(','),
  ]
  for (const inv of daftar) {
    baris.push(
      [
        inv.invoiceNumber,
        inv.status,
        inv.encounter.encounterNumber,
        inv.encounter.patient.name,
        inv.encounter.patient.medicalRecordNumber,
        inv.total,
        inv.payerType,
        inv.paymentMethod ?? '',
        inv.createdAt.toISOString(),
        inv.paidAt?.toISOString() ?? '',
      ]
        .map(csvNilai)
        .join(',')
    )
  }

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'EKSPOR_KLAIM',
    objectType: 'Invoice',
    summary: `Ekspor CSV data klaim (${daftar.length} baris)`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  const csv = '\uFEFF' + baris.join('\r\n') // BOM agar Excel membaca UTF-8
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="klaim-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
