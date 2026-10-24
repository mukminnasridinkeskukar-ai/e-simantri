'use client'

// ============================================================
// e-SIMANTRI — Jejak audit (Fase 0)
// Append-only: siapa, peran, kapan, aksi, objek, ringkasan, IP.
// Terlingkup praktik aktif; peristiwa global pengguna praktik ini
// (mis. masuk akun) juga ditampilkan dengan kolom praktik "—".
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { auditActionLabel } from '@/lib/roles'
import { listAuditAction } from '@/server/actions'
import type { AppStatus, AuditRowDTO } from '@/lib/dto'

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const ACTION_FILTERS = [
  'SEMUA',
  'MASUK_BERHASIL',
  'MASUK_GAGAL',
  'MASUK_TAHAP_AWAL',
  'VERIFIKASI_2FA_BERHASIL',
  'VERIFIKASI_2FA_GAGAL',
  'KELUAR',
  'PILIH_PRAKTIK',
  'GANTI_PRAKTIK',
  'PROFIL_PRAKTIK_DIUBAH',
  'PENGGUNA_DITAMBAHKAN',
  'PENGGUNA_DIAKTIFKAN',
  'PENGGUNA_DINONAKTIFKAN',
  'PERAN_KEANGGOTAAN_DIUBAH',
  'KATA_SANDI_DIUBAH',
  'AKUN_2FA_SETUP_DIMULAI',
  'AKUN_2FA_DIAKTIFKAN',
  'AKUN_2FA_DIMATIKAN',
  'SESI_DICABUT',
  'SESI_KEDALUWARSA',
  'AKSES_DITOLAK',
  'INISIALISASI',
]

export function AuditView({ state }: { state: Extract<AppStatus, { status: 'ready' }> }) {
  const [rows, setRows] = useState<AuditRowDTO[] | null>(null)
  const [action, setAction] = useState('SEMUA')
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [reload, setReload] = useState(0)

  const load = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let active = true
    listAuditAction({ action, q }).then((data) => {
      if (active) setRows(data)
    })
    return () => {
      active = false
    }
  }, [action, q, reload])

  const distinctActions = useMemo(() => {
    const present = new Set((rows ?? []).map((r) => r.action))
    return ACTION_FILTERS.filter((a) => a === 'SEMUA' || present.has(a) || a === action)
  }, [rows, action])

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">Jejak audit</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Catatan append-only yang tidak dapat diubah pengguna. Seluruh aksi administratif dan
            keamanan dicatat; akses isi klinis ditambahkan pada Fase 2. Maksimum 200 entri terbaru.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="min-h-11">
          <RefreshCw className="h-4 w-4" /> Muat ulang
        </Button>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="min-h-11 w-full sm:w-64" aria-label="Filter jenis aksi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {distinctActions.map((a) => (
              <SelectItem key={a} value={a}>
                {a === 'SEMUA' ? 'Semua jenis aksi' : auditActionLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(qInput.trim())
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Cari pada ringkasan atau nama pelaku…"
            className="min-h-11 pl-9"
            aria-label="Cari jejak audit"
          />
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Belum ada entri yang cocok. Jejak audit terisi otomatis seiring penggunaan sistem.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">Waktu</TableHead>
                    <TableHead className="min-w-32">Pelaku</TableHead>
                    <TableHead className="min-w-32">Aksi</TableHead>
                    <TableHead className="min-w-64">Ringkasan</TableHead>
                    <TableHead className="min-w-28">Praktik</TableHead>
                    <TableHead className="min-w-20">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium">{r.actorName ?? '—'}</p>
                        {r.actorRole && (
                          <p className="text-xs text-muted-foreground">{r.actorRole}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.action.includes('GAGAL') || r.action === 'AKSES_DITOLAK'
                              ? 'destructive'
                              : r.action.includes('BERHASIL') || r.action.includes('DIAKTIFKAN')
                                ? 'default'
                                : 'secondary'
                          }
                          className="text-[11px]"
                        >
                          {auditActionLabel(r.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.summary}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.organizationName ?? '— (global)'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.ip ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
