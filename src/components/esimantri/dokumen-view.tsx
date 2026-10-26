'use client'

// ============================================================
// e-SIMANTRI — Daftar dokumen ringkasan/salinan (Fase 4)
// Metadata saja; isi dibuka lewat halaman cetak /cetak/[id]
// yang otomatis diaudit bila dibuka bukan penerbitnya.
// Append-only: dokumen tidak dapat diubah/dihapus di sini.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { describeKind, docRelationLabel } from '@/lib/payer'
import type { SummaryDocKind, SummaryDocRowDTO } from '@/lib/dto'
import { listDocumentsAction } from '@/server/documents'

function fmtDT(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function DokumenView() {
  const { toast } = useToast()
  const [rows, setRows] = useState<SummaryDocRowDTO[] | null>(null)
  const [filter, setFilter] = useState<'SEMUA' | SummaryDocKind>('SEMUA')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await listDocumentsAction()
      if (data === null) {
        toast({
          title: 'Akses ditolak',
          description: 'Anda tidak memiliki izin melihat dokumen.',
          variant: 'destructive',
        })
        setRows([])
      } else {
        setRows(data)
      }
    } finally {
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const visible = (rows ?? []).filter((r) => filter === 'SEMUA' || r.kind === filter)

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-lg font-semibold sm:text-xl">Ringkasan & Salinan</h1>
        <p className="text-sm text-muted-foreground">
          Dokumen yang pernah diterbitkan untuk pasien (ringkasan pelayanan dan salinan catatan
          klinis). Daftar bersifat append-only: dokumen yang terbit tidak dapat diubah atau
          dihapus; salinan terkini diterbitkan sebagai dokumen bernomor baru. Pembukaan isi
          dokumen oleh pihak selain penerbitnya tercatat pada jejak audit.
        </p>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Dokumen terbit</CardTitle>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {(['SEMUA', 'RINGKASAN_PELAYANAN', 'SALINAN_CATATAN'] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={filter === k ? 'default' : 'outline'}
                  onClick={() => setFilter(k)}
                  className="min-h-9"
                >
                  {k === 'SEMUA' ? 'Semua' : describeKind(k)}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={load}
                disabled={refreshing}
                aria-label="Muat ulang"
                className="min-h-9"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <CardDescription>
            Terbitkan dokumen baru dari catatan klinis yang sudah terkunci (kartu Dokumen pada
            catatan terkunci).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat daftar dokumen…
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filter === 'SEMUA'
                ? 'Belum ada dokumen yang diterbitkan pada praktik ini.'
                : 'Belum ada dokumen jenis ini.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((d) => (
                <li key={d.id}>
                  <DocRow row={d} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DocRow({ row }: { row: SummaryDocRowDTO }) {
  const penerima =
    row.recipientRelation === 'PASIEN'
      ? 'Pasien sendiri'
      : `${docRelationLabel(row.recipientRelation)}${row.recipientName ? ` — ${row.recipientName}` : ''}`

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-semibold">{row.number}</p>
          <Badge variant={row.kind === 'RINGKASAN_PELAYANAN' ? 'secondary' : 'outline'}>
            <FileText className="mr-1 h-3 w-3" />
            {describeKind(row.kind)}
          </Badge>
        </div>
        <p className="mt-1 text-sm">
          {row.patientName} <span className="font-mono text-xs text-muted-foreground">({row.mrn})</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Penerima: {penerima} · Keperluan: {row.purpose}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Diterbitkan {fmtDT(row.issuedAt)} oleh {row.issuedByName}
          {row.isIssuer ? ' (Anda)' : ''}
        </p>
      </div>
      <a
        href={`/cetak/${row.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
      >
        <Printer className="h-4 w-4" /> Buka/Cetak
      </a>
    </div>
  )
}
