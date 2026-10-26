'use client'

// ============================================================
// e-SIMANTRI — Kartu Dokumen pada catatan TERKUNCI (Fase 4)
// Menerbitkan RINGKASAN PELAYANAN / SALINAN CATATAN untuk pasien.
// Aturan:
// - Hanya dari catatan TERKUNCI (server yang menegakkan).
// - PPA: hanya dari catatan miliknya; Rekam Medis: untuk tugas
//   administrasi salinan — keduanya selalu diaudit.
// - Dokumen append-only: tidak ada ubah/hapus di kartu ini.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { roleHasPermission, type RoleKey } from '@/lib/roles'
import { describeKind, DOC_KIND_OPTIONS, DOC_RELATION_OPTIONS } from '@/lib/payer'
import type { AppStatus, SummaryDocKind, SummaryDocRowDTO } from '@/lib/dto'
import { issueDocumentAction, listDocumentsForNoteAction } from '@/server/documents'

function fmtDT(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function DokumenCard({
  state,
  encounterId,
  isAuthor,
}: {
  state: Extract<AppStatus, { status: 'ready' }>
  encounterId: string
  isAuthor: boolean
}) {
  const { toast } = useToast()
  const role = state.context.role as RoleKey
  const canIssue = roleHasPermission(role, 'dokumen.terbitkan')
  const canSee = roleHasPermission(role, 'dokumen.lihat')
  // PPA hanya menerbitkan dari catatan miliknya; Rekam Medis bebas dalam lingkup praktik.
  const mayIssueHere = canIssue && (role !== 'PPA' || isAuthor)

  const [rows, setRows] = useState<SummaryDocRowDTO[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const data = await listDocumentsForNoteAction(encounterId)
    setRows(data ?? [])
  }, [encounterId])

  useEffect(() => {
    if (!canSee) return
    let active = true
    listDocumentsForNoteAction(encounterId).then((data) => {
      if (active) setRows(data ?? [])
    })
    return () => {
      active = false
    }
  }, [canSee, encounterId])

  if (!canSee) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Dokumen untuk pasien
          </CardTitle>
          {mayIssueHere && (
            <Button size="sm" onClick={() => setOpen(true)} className="ml-auto min-h-9">
              Terbitkan dokumen
            </Button>
          )}
        </div>
        <CardDescription>
          Ringkasan pelayanan atau salinan catatan klinis diberikan kepada pasien sesuai
          permintaan. Dokumen disimpan sebagai snapshot dan tidak dapat diubah/dihapus;
          salinan terkini diterbitkan sebagai nomor baru.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada dokumen diterbitkan untuk catatan ini.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-2.5"
              >
                <p className="font-mono text-sm font-semibold">{d.number}</p>
                <Badge variant={d.kind === 'RINGKASAN_PELAYANAN' ? 'secondary' : 'outline'}>
                  {describeKind(d.kind)}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {fmtDT(d.issuedAt)} · {d.issuedByName}
                </p>
                <a
                  href={`/cetak/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs hover:bg-accent"
                >
                  <Printer className="h-3.5 w-3.5" /> Buka/Cetak
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <IssueDialog
        open={open}
        onOpenChange={setOpen}
        encounterId={encounterId}
        onDone={async (msg) => {
          setOpen(false)
          toast({ title: 'Dokumen diterbitkan', description: msg })
          await load()
        }}
      />
    </Card>
  )
}

function IssueDialog({
  open,
  onOpenChange,
  encounterId,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  encounterId: string
  onDone: (message: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [kind, setKind] = useState<SummaryDocKind>('RINGKASAN_PELAYANAN')
  const [purpose, setPurpose] = useState('')
  const [relation, setRelation] = useState('PASIEN')
  const [recipientName, setRecipientName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const res = await issueDocumentAction(encounterId, {
        kind,
        purpose,
        recipientRelation: relation,
        recipientName: relation === 'PASIEN' ? null : recipientName,
      })
      if (res.ok) {
        setPurpose('')
        setRecipientName('')
        setRelation('PASIEN')
        await onDone(res.message ?? `Dokumen ${res.number} diterbitkan.`)
      } else {
        toast({ title: 'Penerbitan ditolak', description: res.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terbitkan dokumen untuk pasien</DialogTitle>
          <DialogDescription>
            Isi dokumen diambil dari catatan terkunci ini pada saat penerbitan (snapshot) dan
            tidak dapat diubah setelahnya. Penerbitan tercatat pada jejak audit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Jenis dokumen</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SummaryDocKind)}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {kind === 'RINGKASAN_PELAYANAN'
                ? 'Ringkasan singkat pelayanan: keluhan, diagnosis, tindakan, obat, edukasi, tindak lanjut.'
                : 'Salinan lengkap seluruh isi catatan klinis sesuai isi minimum PMK 24/2022.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-purpose">Keperluan pemberian *</Label>
            <Input
              id="doc-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Mis. kontrol ke rumah sakit rujukan / permintaan pasien"
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Penerima dokumen</Label>
            <Select value={relation} onValueChange={setRelation}>
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_RELATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {relation !== 'PASIEN' && (
            <div className="space-y-1.5">
              <Label htmlFor="doc-recipient">Nama penerima *</Label>
              <Input
                id="doc-recipient"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Nama lengkap penerima selain pasien"
                className="min-h-11"
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
            Batal
          </Button>
          <Button onClick={submit} disabled={busy || !purpose.trim()} className="min-h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Terbitkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
