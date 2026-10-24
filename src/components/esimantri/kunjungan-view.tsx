'use client'

// ============================================================
// e-SIMANTRI — Kunjungan praktik (Fase 1)
// Daftar kunjungan hari ini & riwayat, buka kunjungan baru,
// tutup kunjungan tanpa pemeriksaan (tercatat di kelengkapan).
// Metadata saja — isi klinis hanya lewat menu Catatan Klinis.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { DoorOpen, DoorClosed, Loader2, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { roleHasPermission, type RoleKey } from '@/lib/roles'
import { payerLabel } from '@/lib/payer'
import type { AppStatus, EncounterRowDTO, PatientRowDTO } from '@/lib/dto'
import {
  closeEncounterAction,
  listEncountersAction,
  listPatientsAction,
  openEncounterAction,
} from '@/server/patients'

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

export function KunjunganView({ state }: { state: Extract<AppStatus, { status: 'ready' }> }) {
  const { toast } = useToast()
  const role = state.context.role as RoleKey
  const canOpen = roleHasPermission(role, 'kunjungan.buka')
  const canClose = roleHasPermission(role, 'kunjungan.tutup')
  const canNote = roleHasPermission(role, 'catatan.klinis.lihat')

  const [reload, setReload] = useState(0)
  const load = useCallback(() => setReload((n) => n + 1), [])
  const [openNew, setOpenNew] = useState(false)
  const [closeTarget, setCloseTarget] = useState<EncounterRowDTO | null>(null)

  async function handleClose(reason: string) {
    if (!closeTarget) return
    const res = await closeEncounterAction(closeTarget.id, reason)
    if (res.ok) {
      toast({ title: 'Kunjungan ditutup', description: res.message })
      setCloseTarget(null)
      load()
    } else {
      toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">Kunjungan praktik</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tanggal dan jam buka-tutup kunjungan tercatat otomatis (isi minimum PMK 24/2022).
            Isi klinis kunjungan dibuka lewat menu Catatan Klinis.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} className="min-h-11">
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </Button>
          {canOpen && (
            <Button onClick={() => setOpenNew(true)} className="min-h-11">
              <Plus className="h-4 w-4" /> Buka kunjungan
            </Button>
          )}
        </div>
      </section>

      <Tabs defaultValue="hari-ini">
        <TabsList>
          <TabsTrigger value="hari-ini" className="min-h-11">
            Hari ini
          </TabsTrigger>
          <TabsTrigger value="riwayat" className="min-h-11">
            Riwayat
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hari-ini">
          <EncounterTable
            scope="HARI_INI"
            reload={reload}
            canClose={canClose}
            canNote={canNote}
            onCloseTarget={setCloseTarget}
          />
        </TabsContent>
        <TabsContent value="riwayat">
          <EncounterTable
            scope="RIWAYAT"
            reload={reload}
            canClose={canClose}
            canNote={canNote}
            onCloseTarget={setCloseTarget}
          />
        </TabsContent>
      </Tabs>

      <OpenEncounterDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onDone={() => {
          setOpenNew(false)
          load()
        }}
      />

      <AlertDialog open={!!closeTarget} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tutup kunjungan tanpa pemeriksaan?</AlertDialogTitle>
            <AlertDialogDescription>
              {closeTarget?.patientName} ({closeTarget?.mrn}) — kunjungan akan ditutup dan
              muncul di dasbor kelengkapan sebagai kunjungan tanpa catatan terkunci. Isi
              rekam medis tidak pernah dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CloseReasonBody onSubmit={handleClose} />
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EncounterTable({
  scope,
  reload,
  canClose,
  canNote,
  onCloseTarget,
}: {
  scope: 'HARI_INI' | 'RIWAYAT'
  reload: number
  canClose: boolean
  canNote: boolean
  onCloseTarget: (e: EncounterRowDTO) => void
}) {
  const [rows, setRows] = useState<EncounterRowDTO[] | null>(null)

  useEffect(() => {
    let active = true
    listEncountersAction(scope).then((data) => {
      if (active) setRows(data)
    })
    return () => {
      active = false
    }
  }, [scope, reload])

  if (rows === null)
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  if (rows.length === 0)
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Belum ada kunjungan pada tampilan ini.
        </CardContent>
      </Card>
    )

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="min-w-32 px-3 py-2 font-medium">Waktu</th>
                <th className="min-w-44 px-3 py-2 font-medium">Pasien</th>
                <th className="min-w-28 px-3 py-2 font-medium">Penjamin</th>
                <th className="min-w-36 px-3 py-2 font-medium">Status</th>
                <th className="min-w-36 px-3 py-2 font-medium">Catatan</th>
                {canClose && <th className="min-w-24 px-3 py-2 text-right font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(e.openedAt)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{e.patientName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{e.mrn}</p>
                  </td>
                  <td className="px-3 py-2 text-sm">{payerLabel(e.payerType)}</td>
                  <td className="px-3 py-2">
                    {e.status === 'DALAM_PROSES' ? (
                      <Badge variant="default">Berlangsung</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {e.closedAt ? 'Selesai · ' + fmtTime(e.closedAt) : 'Selesai'}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {e.noteStatus === 'TERKUNCI' ? (
                      <span className="text-primary">Terkunci{e.isMine ? ' (milik Anda)' : ''}</span>
                    ) : e.noteStatus === 'DRAF' ? (
                      <span>
                        {'Draf' + (e.noteAuthorName ? ' — ' + e.noteAuthorName : '')}
                        {e.isMine ? ' (milik Anda)' : ''}
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">Belum ada catatan</span>
                    )}
                  </td>
                  {canClose && (
                    <td className="px-3 py-2 text-right">
                      {e.status === 'DALAM_PROSES' && e.noteStatus !== 'TERKUNCI' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-11"
                          onClick={() => onCloseTarget(e)}
                        >
                          <DoorClosed className="h-4 w-4" />
                          <span className="ml-1 text-xs">Tutup</span>
                        </Button>
                      )}
                      {e.status === 'SELESAI' && (
                        <DoorOpen className="ml-auto h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function OpenEncounterDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [patients, setPatients] = useState<PatientRowDTO[] | null>(null)
  const [patientId, setPatientId] = useState('')
  const [payerType, setPayerType] = useState('UMUM')
  const [payerNumber, setPayerNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPatientId('')
      setPayerType('UMUM')
      setPayerNumber('')
      setError(null)
      listPatientsAction('').then((rows) => setPatients((rows ?? []).filter((p) => p.isActive)))
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId) {
      setError('Pilih pasien terlebih dahulu.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await openEncounterAction(patientId, payerType, payerNumber)
      if (res.ok) {
        toast({ title: 'Berhasil', description: res.message })
        onDone()
      } else {
        setError(res.error ?? 'Gagal membuka kunjungan.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buka kunjungan baru</DialogTitle>
          <DialogDescription>
            Waktu buka dicatat otomatis. Penjamin dapat diisi sesuai kartu yang ditunjukkan
            pasien; tidak ada integrasi ke sistem penjamin pada fase ini.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Pasien</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder={patients === null ? 'Memuat…' : 'Pilih pasien'} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {(patients ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName} · {p.mrn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pasien belum terdaftar? Daftarkan lebih dahulu di menu Pasien.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Penjamin</Label>
            <Select value={payerType} onValueChange={setPayerType}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['UMUM', 'BPJS', 'ASURANSI', 'LAINNYA'].map((v) => (
                  <SelectItem key={v} value={v}>
                    {payerLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {payerType !== 'UMUM' && (
            <div className="space-y-1.5">
              <Label htmlFor="kunj-no">Nomor kartu penjamin</Label>
              <Input
                id="kunj-no"
                value={payerNumber}
                onChange={(e) => setPayerNumber(e.target.value)}
                className="min-h-11"
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
              Batal
            </Button>
            <Button type="submit" disabled={busy} className="min-h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Buka kunjungan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CloseReasonBody({ onSubmit }: { onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="kunj-alasan">Alasan (disarankan, tercatat di audit)</Label>
        <Textarea
          id="kunj-alasan"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Mis. pasien pulang sebelum diperiksa."
          className="min-h-11"
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
        <AlertDialogAction
          className="min-h-11"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault()
            setBusy(true)
            onSubmit(reason).finally(() => setBusy(false))
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Ya, tutup kunjungan
        </AlertDialogAction>
      </AlertDialogFooter>
    </div>
  )
}
