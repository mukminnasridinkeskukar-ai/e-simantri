import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { BadgeTagihan } from '@/components/klinis/badge-status'
import { TombolDibayar, TombolBatalkanTagihan, TombolEksporKlaim } from '@/components/klinis/aksi-klaim'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Receipt, AlertCircle } from 'lucide-react'
import { formatRupiah, formatWaktuLengkap } from '@/lib/modules/konstanta'

export default async function HalamanKlaim({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const ctx = await requirePermission('klaim.lihat')
  const sp = await searchParams
  const status = ['DRAFT', 'TERBIT', 'DIBAYAR', 'DIBATALKAN'].includes(sp.status ?? '') ? sp.status! : ''

  const [daftar, siapDitagih] = await Promise.all([
    db.invoice.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { encounter: { include: { patient: true } } },
    }),
    db.encounter.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'] } },
      include: { patient: true, invoices: true },
      take: 40,
      orderBy: { lockedAt: 'desc' },
    }),
  ])

  const belumDitagih = siapDitagih.filter((k) => k.invoices.every((i) => i.status === 'DIBATALKAN'))
  const bisaKelola = hasPermission(ctx.roles, 'klaim.kelola')
  const totalTerbit = daftar.filter((i) => i.status === 'TERBIT').reduce((a, i) => a + i.total, 0)
  const totalBayar = daftar.filter((i) => i.status === 'DIBAYAR').reduce((a, i) => a + i.total, 0)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tagihan & Klaim</h1>
          <p className="text-sm text-muted-foreground">
            Pencatatan ringan dari kunjungan terkunci. Tidak ada integrasi BPJS — hanya data tagihan dan ekspor.
          </p>
        </div>
        <TombolEksporKlaim />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Menunggu pembayaran</p>
            <p className="text-lg font-semibold">{formatRupiah(totalTerbit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Sudah dibayar</p>
            <p className="text-lg font-semibold">{formatRupiah(totalBayar)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Kunjungan terkunci belum ditagih</p>
            <p className="text-lg font-semibold">{belumDitagih.length}</p>
          </CardContent>
        </Card>
      </div>

      {bisaKelola && belumDitagih.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" /> Siap ditagih ({belumDitagih.length})
            </CardTitle>
            <CardDescription>Buat tagihan lewat tab &quot;Tagihan&quot; pada ruang kerja kunjungan.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {belumDitagih.slice(0, 8).map((k) => (
              <Link
                key={k.id}
                href={`/kunjungan/${k.id}?tab=tagihan`}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
              >
                {k.encounterNumber} · {k.patient.name}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> Daftar tagihan
            <Badge variant="secondary" className="ml-1">
              {daftar.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Filter:{' '}
            <Link href="/klaim" className="text-primary underline underline-offset-2">
              semua
            </Link>{' '}
            ·{' '}
            <Link href="/klaim?status=TERBIT" className="text-primary underline underline-offset-2">
              terbit
            </Link>{' '}
            ·{' '}
            <Link href="/klaim?status=DIBAYAR" className="text-primary underline underline-offset-2">
              dibayar
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {daftar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada tagihan.</p>
          ) : (
            daftar.map((inv) => {
              const items = JSON.parse(inv.items) as Array<{ deskripsi: string; qty: number; harga: number }>
              return (
                <div key={inv.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{inv.invoiceNumber}</span>
                    <BadgeTagihan status={inv.status} />
                    <Link href={`/kunjungan/${inv.encounterId}?tab=tagihan`} className="text-primary underline underline-offset-2">
                      {inv.encounter.patient.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{inv.encounter.encounterNumber}</span>
                    <span className="ml-auto font-semibold">{formatRupiah(inv.total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {items.map((it) => `${it.deskripsi}×${it.qty}`).join(', ')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dibuat {formatWaktuLengkap(inv.createdAt)} oleh {inv.createdByLabel}
                    {inv.paidAt ? ` · dibayar ${formatWaktuLengkap(inv.paidAt)} (${inv.paymentMethod?.toLowerCase()})` : ''}
                    {inv.canceledReason ? ` · dibatalkan: ${inv.canceledReason}` : ''}
                  </p>
                  {bisaKelola && inv.status === 'TERBIT' ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <TombolDibayar invoiceId={inv.id} />
                      <TombolBatalkanTagihan invoiceId={inv.id} />
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
