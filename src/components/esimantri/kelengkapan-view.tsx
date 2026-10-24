'use client'

// ============================================================
// e-SIMANTRI — Dasbor kelengkapan berkas (Fase 2)
// Untuk Petugas Rekam Medis & Penanggung Jawab.
// Metadata saja: tidak menampilkan isi catatan klinis.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ClipboardList, FileCheck2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import type { AppStatus, CompletenessDashboardDTO } from '@/lib/dto'
import { completenessDashboardAction } from '@/server/clinical'

function fmtDT(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function KelengkapanView() {
  const { toast } = useToast()
  const [data, setData] = useState<CompletenessDashboardDTO | null>(null)
  const [reload, setReload] = useState(0)

  const load = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let active = true
    completenessDashboardAction().then((d) => {
      if (active) setData(d)
    })
    return () => {
      active = false
    }
  }, [reload])

  if (data === null)
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">Dasbor kelengkapan berkas</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pemantauan kelengkapan dokumentasi kunjungan. Tampilan ini hanya memuat metadata —
            isi catatan klinis tidak dibuka dari halaman ini.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="min-h-11">
          <RefreshCw className="h-4 w-4" /> Muat ulang
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={<ClipboardList className="h-4 w-4" />} label="Kunjungan hari ini" value={data.totalHariIni} />
        <StatCard icon={<ClipboardList className="h-4 w-4" />} label="Kunjungan berlangsung" value={data.dalamProses} />
        <StatCard icon={<FileCheck2 className="h-4 w-4" />} label="Catatan draf" value={data.catatanDraf} />
        <StatCard icon={<FileCheck2 className="h-4 w-4" />} label="Catatan terkunci" value={data.catatanTerkunci} />
      </section>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium">
              Menunggu kelengkapan: <b>{data.tanpaCatatanTerkunci}</b> kunjungan
            </p>
          </div>
          {data.rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Semua kunjungan sudah memiliki catatan terkunci. Kerja bagus!
            </p>
          ) : (
            <div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
              {data.rows.map((r) => (
                <div key={r.encounterId} className="rounded-lg border p-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.patientName} <span className="font-mono text-xs text-muted-foreground">{r.mrn}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={r.noteStatus === 'DRAF' ? 'secondary' : 'outline'} className="text-[10px]">
                        {r.noteStatus === 'DRAF' ? 'Draf' : 'Tanpa catatan'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {r.status === 'DALAM_PROSES' ? 'Berlangsung' : 'Selesai'}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDT(r.openedAt)}
                    {r.authorName ? ` · draf karya ${r.authorName}` : ''}
                  </p>
                  <p className="mt-1 text-xs">{r.issue}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Catatan: dasbor menandai kunjungan yang ditutup tanpa catatan terkunci maupun draf yang
        belum dikunci. Penguncian menuntut bagian wajib PMK 24/2022 terpenuhi — validasi dilakukan
        di sisi server sehingga catatan tidak dapat dikunci dalam keadaan tidak lengkap.
      </p>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </Card>
  )
}
