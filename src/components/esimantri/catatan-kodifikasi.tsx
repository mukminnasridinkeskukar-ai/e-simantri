'use client'

// ============================================================
// e-SIMANTRI — Kartu Kodifikasi & Resep (Fase 3)
// Dipakai oleh editor catatan (draf), tampilan terkunci, dan
// dialog amandemen.
// - Kode wajib dipilih dari katalog referensi (pencarian server).
// - Draf: set kode & isi resep bebas diubah penulisnya.
// - Terkunci: tampilan baca-saja; resep hanya dapat DIBATALKAN
//   dengan alasan (tidak ada hapus).
// - Subset katalog CONTOH — produksi mengimpor katalog resmi
//   Kemenkes (ICD-10, ICD-9-CM, KFA).
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { Ban, Loader2, Pill, Plus, Search, Tags, X } from 'lucide-react'
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
import type {
  Icd10OptionDTO,
  Icd9CmOptionDTO,
  KfaOptionDTO,
  NoteDetailDTO,
  PrescriptionDTO,
  PrescriptionItemInputDTO,
} from '@/lib/dto'
import { savePrescriptionAction, setDraftCodesAction, voidPrescriptionAction } from '@/server/codes'
import { searchIcd10Action, searchIcd9CmAction, searchKfaAction } from '@/server/terminology'

// ------------------------------------------------------------
// Pemilih kode generik (pencarian server dengan penundaan ketik)
// ------------------------------------------------------------

export function CodePicker<T extends { id: string }>({
  onSearch,
  placeholder,
  disabled,
  onSelect,
  renderOption,
  ariaLabel,
}: {
  onSearch: (q: string) => Promise<T[] | null>
  placeholder: string
  disabled?: boolean
  onSelect: (row: T) => void
  renderOption: (row: T) => React.ReactNode
  ariaLabel: string
}) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setRows([])
      setOpen(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await onSearch(q)
        setRows(res ?? [])
        setOpen(true)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={ariaLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => rows.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-11 pl-9"
          autoComplete="off"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && rows.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="w-full border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent"
              onClick={() => {
                onSelect(row)
                setQuery('')
                setRows([])
                setOpen(false)
              }}
            >
              {renderOption(row)}
            </button>
          ))}
        </div>
      )}
      {open && !searching && rows.length === 0 && query.trim() && (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover p-3 text-center text-xs text-muted-foreground shadow-md">
          Tidak ada kode yang cocok pada katalog subset. Katalog lengkap diimpor pada lingkungan
          produksi.
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Baris editor kodifikasi (draf)
// ------------------------------------------------------------

export interface DxEditRow {
  icd10CodeId: string
  code: string
  description: string
  isPrimary: boolean
  noteText: string
}

export interface PrEditRow {
  icd9CmCodeId: string
  code: string
  description: string
  noteText: string
}

export function DiagnosisEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: DxEditRow[]
  onChange: (rows: DxEditRow[]) => void
  disabled?: boolean
}) {
  function addRow(opt: Icd10OptionDTO) {
    if (rows.some((r) => r.icd10CodeId === opt.id)) return
    onChange([
      ...rows,
      { icd10CodeId: opt.id, code: opt.code, description: opt.description, isPrimary: rows.length === 0, noteText: '' },
    ])
  }
  return (
    <div className="space-y-2">
      <Label>Diagnosis ICD-10</Label>
      {!disabled && (
        <CodePicker
          ariaLabel="Cari kode ICD-10"
          placeholder="Cari kode atau nama diagnosis (mis. hipertensi, I10)…"
          disabled={disabled}
          onSearch={searchIcd10Action}
          onSelect={addRow}
          renderOption={(o) => (
            <span>
              <span className="font-mono font-semibold">{o.code}</span> — {o.description}
            </span>
          )}
        />
      )}
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Belum ada kode diagnosis.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.icd10CodeId} className="rounded-md border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="font-mono font-semibold">{r.code}</span> — {r.description}
                    {r.isPrimary && (
                      <Badge className="ml-2 align-middle text-[10px]" variant="default">
                        Utama
                      </Badge>
                    )}
                  </p>
                </div>
                {!disabled && (
                  <div className="flex shrink-0 items-center gap-1">
                    {!r.isPrimary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9 px-2 text-xs"
                        disabled={disabled}
                        onClick={() => onChange(rows.map((x, xi) => ({ ...x, isPrimary: xi === i })))}
                      >
                        Jadikan utama
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-9 min-w-9"
                      aria-label={`Hapus kode ${r.code} dari draf`}
                      disabled={disabled}
                      onClick={() => onChange(rows.filter((_, xi) => xi !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {!disabled && (
                <Input
                  value={r.noteText}
                  onChange={(e) =>
                    onChange(rows.map((x, xi) => (xi === i ? { ...x, noteText: e.target.value } : x)))
                  }
                  placeholder="Keterangan spesifik pasien (opsional, mis. terkontrol kurang)"
                  className="mt-2 min-h-9 text-xs"
                  disabled={disabled}
                />
              )}
              {disabled && r.noteText && (
                <p className="mt-1 text-xs text-muted-foreground">{r.noteText}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ProcedureEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: PrEditRow[]
  onChange: (rows: PrEditRow[]) => void
  disabled?: boolean
}) {
  function addRow(opt: Icd9CmOptionDTO) {
    if (rows.some((r) => r.icd9CmCodeId === opt.id)) return
    onChange([...rows, { icd9CmCodeId: opt.id, code: opt.code, description: opt.description, noteText: '' }])
  }
  return (
    <div className="space-y-2">
      <Label>Tindakan ICD-9-CM</Label>
      {!disabled && (
        <CodePicker
          ariaLabel="Cari kode tindakan ICD-9-CM"
          placeholder="Cari kode atau nama tindakan (mis. injeksi, 99.21)…"
          disabled={disabled}
          onSearch={searchIcd9CmAction}
          onSelect={addRow}
          renderOption={(o) => (
            <span>
              <span className="font-mono font-semibold">{o.code}</span> — {o.description}
            </span>
          )}
        />
      )}
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Belum ada kode tindakan.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.icd9CmCodeId} className="rounded-md border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm">
                  <span className="font-mono font-semibold">{r.code}</span> — {r.description}
                </p>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-9 min-w-9 shrink-0"
                    aria-label={`Hapus kode ${r.code} dari draf`}
                    disabled={disabled}
                    onClick={() => onChange(rows.filter((_, xi) => xi !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {!disabled && (
                <Input
                  value={r.noteText}
                  onChange={(e) =>
                    onChange(rows.map((x, xi) => (xi === i ? { ...x, noteText: e.target.value } : x)))
                  }
                  placeholder="Keterangan tindakan (opsional)"
                  className="mt-2 min-h-9 text-xs"
                  disabled={disabled}
                />
              )}
              {disabled && r.noteText && (
                <p className="mt-1 text-xs text-muted-foreground">{r.noteText}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Tampilan baca-saja (catatan terkunci & versi)
// ------------------------------------------------------------

export function CodesReadOnly({
  diagnoses,
  procedures,
}: {
  diagnoses: { code: string; description: string; isPrimary: boolean; noteText: string | null }[]
  procedures: { code: string; description: string; noteText: string | null }[]
}) {
  if (diagnoses.length === 0 && procedures.length === 0) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Diagnosis (ICD-10)
        </p>
        {diagnoses.length === 0 ? (
          <p className="text-sm">—</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {diagnoses.map((d) => (
              <li key={d.code} className="text-sm">
                <span className="font-mono font-semibold">{d.code}</span> — {d.description}
                {d.isPrimary && (
                  <Badge className="ml-1.5 align-middle text-[10px]" variant="default">
                    Utama
                  </Badge>
                )}
                {d.noteText ? <span className="text-muted-foreground"> · {d.noteText}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tindakan (ICD-9-CM)
        </p>
        {procedures.length === 0 ? (
          <p className="text-sm">—</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {procedures.map((p) => (
              <li key={p.code} className="text-sm">
                <span className="font-mono font-semibold">{p.code}</span> — {p.description}
                {p.noteText ? <span className="text-muted-foreground"> · {p.noteText}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const ROUTE_OPTIONS = [
  { value: 'ORAL', label: 'Oral (diminum)' },
  { value: 'TOPIKAL', label: 'Topikal (dioleskan)' },
  { value: 'INHALASI', label: 'Inhalasi' },
  { value: 'INJEKSI', label: 'Injeksi' },
  { value: 'LAINNYA', label: 'Lainnya' },
] as const

function routeLabel(v: string): string {
  return ROUTE_OPTIONS.find((o) => o.value === v)?.label ?? v
}

// ------------------------------------------------------------
// Kartu kodifikasi pada editor catatan
// ------------------------------------------------------------

export function KodifikasiCard({
  note,
  encounterId,
  editable,
  onSaved,
}: {
  note: NoteDetailDTO | null
  encounterId: string
  editable: boolean
  onSaved: (message: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [dxRows, setDxRows] = useState<DxEditRow[]>([])
  const [prRows, setPrRows] = useState<PrEditRow[]>([])
  const [busy, setBusy] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!note) {
      setDxRows([])
      setPrRows([])
      setLoadedFor(null)
      return
    }
    if (loadedFor === note.id) return
    setDxRows(
      (note.diagnoses ?? []).map((d) => ({
        icd10CodeId: d.icd10CodeId,
        code: d.code,
        description: d.description,
        isPrimary: d.isPrimary,
        noteText: d.noteText ?? '',
      }))
    )
    setPrRows(
      (note.procedures ?? []).map((p) => ({
        icd9CmCodeId: p.icd9CmCodeId,
        code: p.code,
        description: p.description,
        noteText: p.noteText ?? '',
      }))
    )
    setLoadedFor(note.id)
  }, [note, loadedFor])

  async function handleSave() {
    setBusy(true)
    try {
      const res = await setDraftCodesAction(encounterId, {
        diagnoses: dxRows.map((d) => ({
          icd10CodeId: d.icd10CodeId,
          isPrimary: d.isPrimary,
          noteText: d.noteText || null,
        })),
        procedures: prRows.map((p) => ({
          icd9CmCodeId: p.icd9CmCodeId,
          noteText: p.noteText || null,
        })),
      })
      if (res.ok) {
        await onSaved(res.message ?? 'Kodifikasi disimpan.')
      } else {
        toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4 text-primary" /> Kodifikasi (Fase 3)
        </CardTitle>
        <CardDescription>
          Pilih kode dari katalog referensi (subset CONTOH). Saat draf bebas diubah; setelah
          dikunci, koreksi hanya lewat amandemen beralasan dan baris lama tetap tersimpan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DiagnosisEditor rows={dxRows} onChange={setDxRows} disabled={!editable} />
        <ProcedureEditor rows={prRows} onChange={setPrRows} disabled={!editable} />
        {editable && (
          <Button onClick={handleSave} disabled={busy} className="min-h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tags className="h-4 w-4" />}
            Simpan kodifikasi
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------
// Kartu resep terstruktur
// ------------------------------------------------------------

export function ResepCard({
  note,
  encounterId,
  editable,
  onReloadNote,
  onSaved,
}: {
  note: NoteDetailDTO | null
  encounterId: string
  editable: boolean
  onReloadNote: () => Promise<void>
  onSaved: (message: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRx, setEditingRx] = useState<PrescriptionDTO | null>(null)
  const [voidingRx, setVoidingRx] = useState<PrescriptionDTO | null>(null)

  const rxs = note?.prescriptions ?? []
  const isAuthor = note?.isAuthor ?? editable

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pill className="h-4 w-4 text-primary" /> Resep terstruktur (Fase 3)
        </CardTitle>
        <CardDescription>
          Obat dipilih dari katalog KFA (subset CONTOH) dengan aturan pakai lengkap. Resep tidak
          dapat dihapus — resep yang salah dibatalkan dengan alasan dan tetap tercatat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!note ? (
          <p className="text-xs text-muted-foreground">
            Simpan draf catatan terlebih dahulu untuk menambahkan resep.
          </p>
        ) : rxs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada resep pada catatan ini.</p>
        ) : (
          <ul className="space-y-2">
            {rxs.map((rx) => (
              <li
                key={rx.id}
                className={`rounded-md border p-3 ${rx.status === 'DIBATALKAN' ? 'opacity-70' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-sm font-medium ${rx.status === 'DIBATALKAN' ? 'line-through' : ''}`}>
                    {rx.number}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {rx.status === 'DIBATALKAN' ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Ban className="h-3 w-3" /> Dibatalkan
                      </Badge>
                    ) : (
                      <>
                        {editable && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-9 px-2 text-xs"
                            onClick={() => {
                              setEditingRx(rx)
                              setDialogOpen(true)
                            }}
                          >
                            Ubah isi
                          </Button>
                        )}
                        {isAuthor && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-9 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => setVoidingRx(rx)}
                          >
                            <Ban className="h-3.5 w-3.5" /> Batalkan
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {rx.status === 'DIBATALKAN' && rx.voidReason && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Alasan pembatalan: {rx.voidReason}
                  </p>
                )}
                <ul className="mt-2 space-y-1.5">
                  {rx.items.map((it) => (
                    <li
                      key={it.id}
                      className={`rounded border bg-muted/40 p-2 text-sm ${
                        rx.status === 'DIBATALKAN' ? 'line-through decoration-muted-foreground' : ''
                      }`}
                    >
                      <p className="font-medium">
                        {it.drugName}{' '}
                        <span className="font-mono text-xs text-muted-foreground">[{it.kfaCode}]</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {routeLabel(it.route)}
                        {it.dose ? ` · ${it.dose}` : ''}
                        {it.frequency ? ` · ${it.frequency}` : ''}
                        {it.durationDays ? ` · ${it.durationDays} hari` : ''}
                        {it.quantity ? ` · ${it.quantity}` : ''}
                        {it.instructions ? ` · ${it.instructions}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {editable && (
          <Button
            onClick={() => {
              setEditingRx(null)
              setDialogOpen(true)
            }}
            className="min-h-11"
          >
            <Plus className="h-4 w-4" /> Tambah resep
          </Button>
        )}
      </CardContent>

      <PrescriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        encounterId={encounterId}
        prescription={editingRx}
        onDone={async (message) => {
          setDialogOpen(false)
          await onReloadNote()
          await onSaved(message)
        }}
      />

      {voidingRx && (
        <VoidResepDialog
          open={!!voidingRx}
          onOpenChange={(o) => !o && setVoidingRx(null)}
          encounterId={encounterId}
          rx={voidingRx}
          onDone={async () => {
            setVoidingRx(null)
            await onReloadNote()
            toast({ title: 'Resep dibatalkan', description: 'Resep tetap tersimpan sebagai riwayat.' })
          }}
        />
      )}
    </Card>
  )
}

// ------------------------------------------------------------
// Dialog isi resep
// ------------------------------------------------------------

interface RxItemDraft {
  kfaCodeId: string
  kfaCode: string
  drugName: string
  dose: string
  route: string
  frequency: string
  durationDays: string
  quantity: string
  instructions: string
}

const EMPTY_ITEM: RxItemDraft = {
  kfaCodeId: '',
  kfaCode: '',
  drugName: '',
  dose: '',
  route: '',
  frequency: '',
  durationDays: '',
  quantity: '',
  instructions: '',
}

function PrescriptionDialog({
  open,
  onOpenChange,
  encounterId,
  prescription,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  encounterId: string
  prescription: PrescriptionDTO | null
  onDone: (message: string) => Promise<void>
}) {
  const [items, setItems] = useState<RxItemDraft[]>([{ ...EMPTY_ITEM }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setItems(
        prescription && prescription.items.length > 0
          ? prescription.items.map((it) => ({
              kfaCodeId: it.kfaCodeId,
              kfaCode: it.kfaCode,
              drugName: it.drugName,
              dose: it.dose ?? '',
              route: it.route,
              frequency: it.frequency ?? '',
              durationDays: it.durationDays != null ? String(it.durationDays) : '',
              quantity: it.quantity ?? '',
              instructions: it.instructions ?? '',
            }))
          : [{ ...EMPTY_ITEM }]
      )
      setError(null)
    }
  }, [open, prescription])

  function updateItem(i: number, patch: Partial<RxItemDraft>) {
    setItems((rows) => rows.map((r, ri) => (ri === i ? { ...r, ...patch } : r)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload: PrescriptionItemInputDTO[] = items.map((it) => ({
        kfaCodeId: it.kfaCodeId,
        drugName: it.drugName,
        dose: it.dose || null,
        route: it.route,
        frequency: it.frequency || null,
        durationDays: it.durationDays ? Number(it.durationDays) : null,
        quantity: it.quantity || null,
        instructions: it.instructions || null,
      }))
      const res = await savePrescriptionAction(encounterId, prescription?.id ?? null, payload)
      if (res.ok) await onDone(res.message ?? 'Resep tersimpan.')
      else setError(res.error ?? 'Resep gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{prescription ? `Ubah isi resep ${prescription.number}` : 'Resep baru'}</DialogTitle>
          <DialogDescription>
            Setiap item wajib memilih obat dari katalog KFA dan jalur pemberian. Subset CONTOH —
            produksi memakai katalog resmi Kemenkes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {items.map((it, i) => (
            <div key={i} className="space-y-2.5 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Item {i + 1}
                </p>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-9 min-w-9"
                    aria-label="Hapus item dari draf resep"
                    onClick={() => setItems((rows) => rows.filter((_, ri) => ri !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {it.kfaCodeId ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 p-2.5">
                  <p className="text-sm font-medium">
                    {it.drugName}{' '}
                    <span className="font-mono text-xs text-muted-foreground">[{it.kfaCode}]</span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-9 px-2 text-xs"
                    onClick={() => updateItem(i, { ...EMPTY_ITEM })}
                  >
                    Ganti obat
                  </Button>
                </div>
              ) : (
                <CodePicker
                  ariaLabel={`Cari obat KFA untuk item ${i + 1}`}
                  placeholder="Cari nama obat (mis. paracetamol, amoksisilin)…"
                  onSearch={searchKfaAction}
                  onSelect={(o: KfaOptionDTO) =>
                    updateItem(i, {
                      kfaCodeId: o.id,
                      kfaCode: o.code,
                      drugName: [o.name, o.strength].filter(Boolean).join(' '),
                    })
                  }
                  renderOption={(o) => (
                    <span>
                      <span className="font-medium">{o.name}</span>
                      {o.strength ? <span className="text-muted-foreground"> {o.strength}</span> : null}
                      {o.dosageForm ? (
                        <span className="text-muted-foreground"> · {o.dosageForm}</span>
                      ) : null}{' '}
                      <span className="font-mono text-xs text-muted-foreground">[{o.code}]</span>
                    </span>
                  )}
                />
              )}

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Jalur pemberian *</Label>
                  <Select
                    value={it.route}
                    onValueChange={(v) => updateItem(i, { route: v })}
                    required
                  >
                    <SelectTrigger className="min-h-11 w-full">
                      <SelectValue placeholder="Pilih jalur…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUTE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`dose-${i}`}>Dosis (mis. 1 tablet)</Label>
                  <Input
                    id={`dose-${i}`}
                    value={it.dose}
                    onChange={(e) => updateItem(i, { dose: e.target.value })}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`freq-${i}`}>Frekuensi (mis. 3x sehari)</Label>
                  <Input
                    id={`freq-${i}`}
                    value={it.frequency}
                    onChange={(e) => updateItem(i, { frequency: e.target.value })}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`dur-${i}`}>Lama (hari)</Label>
                  <Input
                    id={`dur-${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={it.durationDays}
                    onChange={(e) => updateItem(i, { durationDays: e.target.value })}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`qty-${i}`}>Jumlah (mis. No. 10)</Label>
                  <Input
                    id={`qty-${i}`}
                    value={it.quantity}
                    onChange={(e) => updateItem(i, { quantity: e.target.value })}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`instr-${i}`}>Keterangan signa</Label>
                  <Input
                    id={`instr-${i}`}
                    value={it.instructions}
                    onChange={(e) => updateItem(i, { instructions: e.target.value })}
                    placeholder="mis. sesudah makan"
                    className="min-h-11"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => setItems((rows) => [...rows, { ...EMPTY_ITEM }])}
            className="min-h-11"
          >
            <Plus className="h-4 w-4" /> Tambah item
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
              Batal
            </Button>
            <Button type="submit" disabled={busy} className="min-h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pill className="h-4 w-4" />}
              Simpan resep
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------
// Dialog pembatalan resep (append-only)
// ------------------------------------------------------------

function VoidResepDialog({
  open,
  onOpenChange,
  encounterId,
  rx,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  encounterId: string
  rx: PrescriptionDTO
  onDone: () => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await voidPrescriptionAction(encounterId, rx.id, reason)
      if (res.ok) await onDone()
      else setError(res.error ?? 'Pembatalan gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" /> Batalkan resep {rx.number}?
          </DialogTitle>
          <DialogDescription>
            Resep tidak dapat dihapus. Pembatalan mencatat status, alasan, pelaku, dan waktu —
            resep tetap tersimpan sebagai bagian rekam medis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="void-alasan">Alasan pembatalan *</Label>
            <Input
              id="void-alasan"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. obat tidak tersedia — diganti resep baru."
              className="min-h-11"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
              Kembali
            </Button>
            <Button type="submit" variant="destructive" disabled={busy} className="min-h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Batalkan resep
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
