import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { TombolSerahkan, TombolBatalkanResep } from '@/components/klinis/aksi-farmasi'
import { BadgeResep } from '@/components/klinis/badge-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Pill } from 'lucide-react'
import { formatWaktuLengkap } from '@/lib/modules/konstanta'

export default async function HalamanFarmasi() {
  const ctx = await requirePermission('resep.serahkan')

  const antrean = await db.prescription.findMany({
    where: { organizationId: ctx.organizationId, status: 'DIBUAT' },
    orderBy: { createdAt: 'asc' },
    include: { encounter: { include: { patient: true } }, items: true },
  })

  const selesai = await db.prescription.findMany({
    where: { organizationId: ctx.organizationId, status: 'DISELESAIKAN' },
    orderBy: { dispensedAt: 'desc' },
    take: 10,
    include: { encounter: { include: { patient: true } }, items: true },
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Farmasi</h1>
        <p className="text-sm text-muted-foreground">
          Antrean resep menunggu penyerahan obat. Penyerahan dan pembatalan selalu tercatat di jejak audit.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pill className="h-4 w-4" /> Menunggu diserahkan
            <BadgeResep status="DIBUAT" />
          </CardTitle>
          <CardDescription>Urut dari resep paling lama.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {antrean.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada resep menunggu. 👍</p>
          ) : (
            antrean.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.prescriptionNumber}</span>
                  <Link href={`/kunjungan/${r.encounterId}`} className="text-primary underline underline-offset-2">
                    {r.encounter.patient.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {r.encounter.encounterNumber} · dibuat {formatWaktuLengkap(r.createdAt)} oleh {r.createdByLabel}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 text-muted-foreground">
                  {r.items.map((it) => (
                    <li key={it.id}>
                      {it.drugName} {it.strength ?? ''} {it.form ?? ''} — {it.quantity} · {it.usage}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TombolSerahkan prescriptionId={r.id} />
                  <TombolBatalkanResep prescriptionId={r.id} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Terakhir diserahkan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {selesai.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat penyerahan.</p>
          ) : (
            selesai.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
                <span className="font-medium">{r.prescriptionNumber}</span>
                <span>{r.encounter.patient.name}</span>
                <span className="text-xs text-muted-foreground">
                  {r.items.length} obat · diserahkan {formatWaktuLengkap(r.dispensedAt)} oleh {r.dispensedByLabel}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
