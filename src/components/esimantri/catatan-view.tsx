'use client'

// ============================================================
// e-SIMANTRI — Catatan klinis dokter umum (Fase 2)
// Formulir mengikuti isi minimum PMK 24/2022.
// - Draf: bebas diubah oleh penulis sampai dikunci.
// - Kunci: ditolak bila bagian wajib belum lengkap; kunjungan
//   berlangsung ikut ditutup.
// - Terkunci: hanya amandemen dengan alasan; versi lama tersimpan.
// - Akses bukan penulis selalu diaudit.
// Tidak ada tombol hapus — sesuai larangan keras.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import {
  FileLock2,
  History,
  Loader2,
  Lock,
  Save,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { useToast } from '@/hooks/use-toast'
import { roleHasPermission } from '@/lib/roles'
import { sexLabel } from '@/lib/payer'
import { REQUIRED_NOTE_FIELDS } from '@/lib/completeness'
import type {
  AppStatus,
  EncounterRowDTO,
  NoteContentDTO,
  NoteDetailDTO,
  NoteVersionDetailDTO,
  NoteVersionRowDTO,
} from '@/lib/dto'
import {
  getNoteVersionDetailAction,
  listNoteVersionsAction,
  lockNoteAction,
  saveDraftNoteAction,
  amendNoteAction,
  getNoteAction,
  listEncountersForNoteAction,
} from '@/server/clinical'
import {
  CodesReadOnly,
  DiagnosisEditor,
  KodifikasiCard,
  ProcedureEditor,
  ResepCard,
  type DxEditRow,
  type PrEditRow,
} from './catatan-kodifikasi'
import { DokumenCard } from './catatan-dokumen'

function fmtDT(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const EMPTY_CONTENT: NoteContentDTO = {
  subjective: '',
  allergiesNote: '',
  objective: '',
  supportingExam: '',
  assessment: '',
  plan: '',
  medsGiven: '',
  otherServices: '',
  education: '',
  followUpPlan: '',
}

export function CatatanView({ state }: { state: Extract<AppStatus, { status: 'ready' }> }) {
  const { toast } = useToast()
  const canEdit = roleHasPermission(state.context.role, 'catatan.klinis.kelola')
  const canLock = roleHasPermission(state.context.role, 'catatan.klinis.kunci')

  const [reload, setReload] = useState(0)
  const loadList = useCallback(() => setReload((n) => n + 1), [])
  const [selected, setSelected] = useState<EncounterRowDTO | null>(null)
  const [note, setNote] = useState<NoteDetailDTO | null>(null)
  const [loadingNote, setLoadingNote] = useState(false)

  // Muat ulang catatan aktif dari server (setelah simpan/kunci/amandemen).
  const reloadNote = useCallback(async () => {
    if (!selected) return
    const detail = await getNoteAction(selected.id)
    setNote(detail)
  }, [selected])

  // Buka kunjungan → muat catatannya (atau kosong bila belum ada).
  const openEncounter = useCallback(async (e: EncounterRowDTO) => {
    setSelected(e)
    setNote(null)
    setLoadingNote(true)
    try {
      const detail = await getNoteAction(e.id)
      setNote(detail)
    } finally {
      setLoadingNote(false)
    }
  }, [])

  async function handleSaved(message: string) {
    toast({ title: 'Tersimpan', description: message })
    if (selected) {
      const detail = await getNoteAction(selected.id)
      setNote(detail)
    }
    loadList()
  }

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-lg font-semibold sm:text-xl">Catatan klinis dokter umum</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Isi minimum PMK 24/2022: keluhan & riwayat, alergi & riwayat obat, pemeriksaan,
          penunjang (bila ada), diagnosis, rencana, obat/tindakan, layanan lain, dan edukasi.
          Catatan terkunci tidak dapat dihapus dan hanya dikoreksi lewat amandemen beralasan.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        {/* Daftar kerja */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4 text-primary" />
              Daftar kunjungan
            </CardTitle>
            <CardDescription>Metadata saja — isi catatan terbuka di panel kanan.</CardDescription>
          </CardHeader>
          <CardContent>
            <Worklist
              reload={reload}
              selectedId={selected?.id ?? null}
              onSelect={openEncounter}
              canNote={canEdit}
            />
          </CardContent>
        </Card>

        {/* Editor / pembaca */}
        <div>
          {!selected ? (
            <Card>
              <CardContent className="flex min-h-56 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Pilih kunjungan pada daftar untuk membuka atau membuat catatan.
              </CardContent>
            </Card>
          ) : loadingNote ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <NoteEditor
              state={state}
              encounter={selected}
              note={note}
              canEdit={canEdit}
              canLock={canLock}
              onSaved={handleSaved}
              onReloadNote={reloadNote}
              onListChanged={loadList}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Worklist({
  reload,
  selectedId,
  onSelect,
  canNote,
}: {
  reload: number
  selectedId: string | null
  onSelect: (e: EncounterRowDTO) => void
  canNote: boolean
}) {
  // Fase 3 — dua daftar: kunjungan yang menunggu dokumentasi dan
  // catatan milik sendiri (termasuk TERKUNCI, untuk melihat kode,
  // resep, membatalkan resep, atau amandemen).
  const [scope, setScope] = useState<'PERLU_DOKUMENTASI' | 'CATATAN_SAYA'>('PERLU_DOKUMENTASI')
  const [rows, setRows] = useState<EncounterRowDTO[] | null>(null)

  useEffect(() => {
    let active = true
    listEncountersForNoteAction(scope).then((data) => {
      if (active) setRows(data)
    })
    return () => {
      active = false
    }
  }, [reload, scope])

  if (rows === null)
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  if (rows.length === 0)
    return (
      <div className="space-y-2">
        <ScopeTabs scope={scope} setScope={setScope} />
        <p className="p-2 text-center text-sm text-muted-foreground">
          {scope === 'PERLU_DOKUMENTASI'
            ? 'Tidak ada kunjungan yang menunggu dokumentasi.'
            : 'Anda belum menulis catatan pada praktik ini.'}
        </p>
      </div>
    )

  return (
    <div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
      <ScopeTabs scope={scope} setScope={setScope} />
      {rows.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onSelect(e)}
          className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
            selectedId === e.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{e.patientName}</p>
            <Badge
              variant={e.noteStatus === 'TERKUNCI' ? 'default' : e.noteStatus === 'DRAF' ? 'secondary' : 'outline'}
              className="shrink-0 text-[10px]"
            >
              {e.noteStatus === 'DRAF' ? 'Draf' : e.noteStatus === 'TERKUNCI' ? 'Terkunci' : 'Belum ada catatan'}
            </Badge>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {e.mrn} · {fmtDT(e.openedAt)}
          </p>
          {e.noteAuthorName && e.noteStatus === 'DRAF' && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Draf karya {e.noteAuthorName}
              {e.isMine ? ' (Anda)' : ''}
            </p>
          )}
        </button>
      ))}
      {!canNote && (
        <p className="pt-2 text-[11px] text-muted-foreground">
          Anda dapat membaca catatan untuk tugas kelola; setiap pembukaan tercatat di jejak audit.
        </p>
      )}
    </div>
  )
}

function ScopeTabs({
  scope,
  setScope,
}: {
  scope: 'PERLU_DOKUMENTASI' | 'CATATAN_SAYA'
  setScope: (s: 'PERLU_DOKUMENTASI' | 'CATATAN_SAYA') => void
}) {
  return (
    <div className="flex gap-1 rounded-md bg-muted p-1" role="tablist" aria-label="Pilih daftar catatan">
      <button
        type="button"
        role="tab"
        aria-selected={scope === 'PERLU_DOKUMENTASI'}
        onClick={() => setScope('PERLU_DOKUMENTASI')}
        className={`min-h-9 flex-1 rounded px-2 text-xs font-medium transition-colors ${
          scope === 'PERLU_DOKUMENTASI' ? 'bg-card shadow-sm' : 'text-muted-foreground'
        }`}
      >
        Perlu dokumentasi
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={scope === 'CATATAN_SAYA'}
        onClick={() => setScope('CATATAN_SAYA')}
        className={`min-h-9 flex-1 rounded px-2 text-xs font-medium transition-colors ${
          scope === 'CATATAN_SAYA' ? 'bg-card shadow-sm' : 'text-muted-foreground'
        }`}
      >
        Catatan saya
      </button>
    </div>
  )
}

// ------------------------------------------------------------
// Editor utama
// ------------------------------------------------------------

function NoteEditor({
  state,
  encounter,
  note,
  canEdit,
  canLock,
  onSaved,
  onReloadNote,
  onListChanged,
}: {
  state: Extract<AppStatus, { status: 'ready' }>
  encounter: EncounterRowDTO
  note: NoteDetailDTO | null
  canEdit: boolean
  canLock: boolean
  onSaved: (message: string) => Promise<void>
  onReloadNote: () => Promise<void>
  onListChanged: () => void
}) {
  const { toast } = useToast()
  const meId = state.me.id
  const isNew = !note
  const editable = (isNew && canEdit) || (!!note && note.status === 'DRAF' && note.isAuthor)
  const locked = note?.status === 'TERKUNCI'
  const isAuthor = note ? note.isAuthor : canEdit

  const [content, setContent] = useState<NoteContentDTO>(EMPTY_CONTENT)
  const [busy, setBusy] = useState(false)
  const [lockOpen, setLockOpen] = useState(false)
  const [amendOpen, setAmendOpen] = useState(false)
  const [versions, setVersions] = useState<NoteVersionRowDTO[] | null>(null)

  useEffect(() => {
    if (note) {
      setContent({
        subjective: note.subjective ?? '',
        allergiesNote: note.allergiesNote ?? '',
        objective: note.objective ?? '',
        supportingExam: note.supportingExam ?? '',
        assessment: note.assessment ?? '',
        plan: note.plan ?? '',
        medsGiven: note.medsGiven ?? '',
        otherServices: note.otherServices ?? '',
        education: note.education ?? '',
        followUpPlan: note.followUpPlan ?? '',
      })
    } else {
      setContent(EMPTY_CONTENT)
    }
  }, [note])

  async function loadVersions() {
    const rows = await listNoteVersionsAction(encounter.id)
    setVersions(rows)
  }

  useEffect(() => {
    if (locked) loadVersions()
  }, [locked, encounter.id])

  async function handleSave() {
    setBusy(true)
    try {
      const res = await saveDraftNoteAction(encounter.id, content)
      if (res.ok) await onSaved(res.message ?? 'Draf disimpan.')
      else toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function handleLock() {
    setBusy(true)
    try {
      const res = await lockNoteAction(encounter.id, content)
      if (res.ok) {
        setLockOpen(false)
        await onSaved(res.message ?? 'Catatan dikunci.')
      } else {
        toast({ title: 'Penguncian ditolak', description: res.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Konteks kunjungan */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
          <div>
            <p className="font-semibold">{encounter.patientName}</p>
            <p className="font-mono text-xs text-muted-foreground">{encounter.mrn}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>Kunjungan dibuka: {fmtDT(encounter.openedAt)}</p>
            <p>Status kunjungan: {encounter.status === 'DALAM_PROSES' ? 'Berlangsung' : 'Selesai'}</p>
          </div>
          <div className="ml-auto">
            {locked ? (
              <Badge className="gap-1" variant="default">
                <Lock className="h-3 w-3" /> Terkunci · versi {note?.versionNumber ?? 1}
              </Badge>
            ) : note ? (
              <Badge variant="secondary">Draf</Badge>
            ) : (
              <Badge variant="outline">Belum ada catatan</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {locked && !isAuthor && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Anda membuka catatan karya {note?.authorName ?? 'PPA lain'} — akses ini bukan sebagai
          penulis dan tercatat otomatis pada jejak audit.
        </p>
      )}

      {locked ? (
        <>
          <LockedNoteBody note={note} />
          {/* Fase 3 — resep terkunci tampil baca-saja; penulis masih dapat membatalkan */}
          <ResepCard
            note={note}
            encounterId={encounter.id}
            editable={false}
            onReloadNote={onReloadNote}
            onSaved={onSaved}
          />
          {/* Fase 4 — terbitkan ringkasan/salinan untuk pasien dari catatan terkunci */}
          <DokumenCard state={state} encounterId={encounter.id} isAuthor={!!note?.isAuthor} />
        </>
      ) : (
        <>
          <NoteForm content={content} setContent={setContent} disabled={!editable} />
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleSave} disabled={busy} className="min-h-11">
                <Save className="h-4 w-4" /> Simpan draf
              </Button>
              {canLock && (
                <Button onClick={() => setLockOpen(true)} disabled={busy} className="min-h-11">
                  <Lock className="h-4 w-4" /> Kunci catatan
                </Button>
              )}
              <p className="w-full text-xs text-muted-foreground sm:w-auto sm:self-center">
                Draf hanya dapat diubah oleh Anda sampai dikunci. Tidak ada penghapusan catatan.
              </p>
            </div>
          )}
          {!editable && (
            <p className="flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Draf ini milik {note?.authorName ?? 'PPA lain'} — hanya penulis yang dapat
              mengubah dan menguncinya.
            </p>
          )}
          {/* Fase 3 — kodifikasi & resep (mengikuti status draf catatan) */}
          <KodifikasiCard
            note={note}
            encounterId={encounter.id}
            editable={editable}
            onSaved={onSaved}
          />
          <ResepCard
            note={note}
            encounterId={encounter.id}
            editable={editable}
            onReloadNote={onReloadNote}
            onSaved={onSaved}
          />
        </>
      )}

      {/* Konfirmasi kunci */}
      <AlertDialog open={lockOpen} onOpenChange={setLockOpen}>
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileLock2 className="h-5 w-5 text-primary" /> Kunci catatan klinis?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Setelah dikunci, catatan tidak dapat diubah atau dihapus. Koreksi hanya lewat
                  amandemen dengan alasan, dan versi lama dipertahankan.
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs">
                  {REQUIRED_NOTE_FIELDS.map((f) => (
                    <li key={f.field}>{f.label}</li>
                  ))}
                </ul>
                {encounter.status === 'DALAM_PROSES' && (
                  <p className="text-xs">
                    Kunjungan yang sedang berlangsung akan ditutup otomatis dengan waktu kunci
                    sebagai jam selesai kunjungan.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Periksa lagi</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                handleLock()
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Kunci sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Amandemen */}
      {locked && note?.isAuthor && (
        <AmendDialog
          open={amendOpen}
          onOpenChange={setAmendOpen}
          note={note}
          onDone={async () => {
            setAmendOpen(false)
            await onReloadNote()
            loadVersions()
            onListChanged()
            toast({ title: 'Amandemen tersimpan' })
          }}
        />
      )}

      {/* Riwayat versi */}
      {locked && note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" /> Riwayat versi
            </CardTitle>
            <CardDescription>
              Versi 1 adalah isi saat pertama dikunci; setiap amandemen menyimpan versi sebelumnya
              beserta alasan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              Versi saat ini: <b>{note.versionNumber}</b> (terkunci {fmtDT(note.lockedAt)} oleh{' '}
              {note.authorName}
              {note.authorProfession ? `, ${note.authorProfession}` : ''}
              {note.authorStrNumber ? `, STR ${note.authorStrNumber}` : ''})
            </p>
            {versions === null ? null : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada amandemen.</p>
            ) : (
              <ul className="space-y-1.5">
                {versions.map((v) => (
                  <li key={v.id}>
                    <VersionRow encounterId={encounter.id} version={v} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {locked && note?.isAuthor && (
        <Button variant="outline" onClick={() => setAmendOpen(true)} className="min-h-11">
          <FileLock2 className="h-4 w-4" /> Amandemen catatan
        </Button>
      )}
    </div>
  )
}

function VersionRow({ encounterId, version }: { encounterId: string; version: NoteVersionRowDTO }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<NoteVersionDetailDTO | null>(null)
  const [busy, setBusy] = useState(false)

  async function openDetail() {
    setBusy(true)
    try {
      setOpen(true)
      setDetail(null)
      const d = await getNoteVersionDetailAction(encounterId, version.versionNumber)
      setDetail(d)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="w-full rounded-lg border p-2.5 text-left text-sm hover:bg-accent"
      onClick={openDetail}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Versi {version.versionNumber}</p>
        <span className="text-xs text-muted-foreground">{fmtDT(version.createdAt)}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Amandemen oleh {version.changedByName} — alasan: {version.reason}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Versi {version.versionNumber}</DialogTitle>
            <DialogDescription>
              {busy
                ? 'Memuat…'
                : detail
                  ? `Tercatat ${fmtDT(detail.createdAt)} oleh ${detail.changedByName} — status saat itu: ${detail.status}. Alasan: ${detail.reason}`
                  : 'Versi tidak dapat dimuat.'}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <ContentReadOnly content={detail.content} />
              {detail.codes && (
                <CodesReadOnly diagnoses={detail.codes.diagnoses} procedures={detail.codes.procedures} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </button>
  )
}

// ------------------------------------------------------------
// Bentuk isi — dipakai editor & tampilan terkunci
// ------------------------------------------------------------

function NoteForm({
  content,
  setContent,
  disabled,
}: {
  content: NoteContentDTO
  setContent: (c: NoteContentDTO) => void
  disabled: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Isi catatan (PMK 24/2022)</CardTitle>
        <CardDescription>
          Bagian bertanda * wajib terisi sebelum catatan dapat dikunci. Tulis “Tidak ada” bila
          memang tidak ada.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <SectionField
          id="subj"
          label="Keluhan utama dan riwayat penyakit *"
          value={content.subjective ?? ''}
          onChange={(v) => setContent({ ...content, subjective: v })}
          disabled={disabled}
          rows={3}
        />
        <SectionField
          id="alergi"
          label="Alergi dan riwayat pemakaian obat yang relevan *"
          value={content.allergiesNote ?? ''}
          onChange={(v) => setContent({ ...content, allergiesNote: v })}
          disabled={disabled}
          rows={3}
        />
        <SectionField
          id="obj"
          label="Hasil pemeriksaan fisik/tambahan *"
          value={content.objective ?? ''}
          onChange={(v) => setContent({ ...content, objective: v })}
          disabled={disabled}
          rows={3}
        />
        <SectionField
          id="penunjang"
          label="Hasil pemeriksaan penunjang (jika ada)"
          value={content.supportingExam ?? ''}
          onChange={(v) => setContent({ ...content, supportingExam: v })}
          disabled={disabled}
          rows={3}
        />
        <SectionField
          id="dx"
          label="Diagnosis * (teks klinis — kodifikasi ICD-10 pada kartu Kodifikasi di bawah)"
          value={content.assessment ?? ''}
          onChange={(v) => setContent({ ...content, assessment: v })}
          disabled={disabled}
          rows={2}
        />
        <SectionField
          id="rencana"
          label="Rencana penatalaksanaan *"
          value={content.plan ?? ''}
          onChange={(v) => setContent({ ...content, plan: v })}
          disabled={disabled}
          rows={2}
        />
        <SectionField
          id="obat"
          label="Obat/tindakan yang diberikan * (resep terstruktur pada kartu Resep di bawah)"
          value={content.medsGiven ?? ''}
          onChange={(v) => setContent({ ...content, medsGiven: v })}
          disabled={disabled}
          rows={2}
        />
        <SectionField
          id="lain"
          label="Pelayanan lainnya"
          value={content.otherServices ?? ''}
          onChange={(v) => setContent({ ...content, otherServices: v })}
          disabled={disabled}
          rows={2}
        />
        <SectionField
          id="edukasi"
          label="Edukasi yang diberikan kepada pasien/keluarga *"
          value={content.education ?? ''}
          onChange={(v) => setContent({ ...content, education: v })}
          disabled={disabled}
          rows={2}
        />
        <SectionField
          id="tindak"
          label="Rencana tindak lanjut/kontrol"
          value={content.followUpPlan ?? ''}
          onChange={(v) => setContent({ ...content, followUpPlan: v })}
          disabled={disabled}
          rows={2}
        />
      </CardContent>
    </Card>
  )
}

function SectionField({
  id,
  label,
  value,
  onChange,
  disabled,
  rows,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
  rows: number
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        className="min-h-11"
      />
    </div>
  )
}

function ContentReadOnly({ content }: { content: NoteContentDTO }) {
  const items: { label: string; value: string | null }[] = [
    { label: 'Keluhan utama dan riwayat', value: content.subjective },
    { label: 'Alergi & riwayat obat', value: content.allergiesNote },
    { label: 'Pemeriksaan', value: content.objective },
    { label: 'Penunjang', value: content.supportingExam },
    { label: 'Diagnosis', value: content.assessment },
    { label: 'Rencana penatalaksanaan', value: content.plan },
    { label: 'Obat/tindakan diberikan', value: content.medsGiven },
    { label: 'Pelayanan lainnya', value: content.otherServices },
    { label: 'Edukasi', value: content.education },
    { label: 'Tindak lanjut', value: content.followUpPlan },
  ]
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {i.label}
          </p>
          <p className="whitespace-pre-wrap text-sm">{i.value ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}

function LockedNoteBody({ note }: { note: NoteDetailDTO | null }) {
  if (!note) return null
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pasien: {note.patientName} ({sexLabel(note.patientSex) || '—'}
        {note.patientDateOfBirth ? `, lahir ${fmtDT(note.patientDateOfBirth).slice(0, 10)}` : ''}) ·
        Kunjungan dibuka {fmtDT(note.openedAt)} · Dikunci {fmtDT(note.lockedAt)}
      </p>
      <ContentReadOnly content={note} />
      <CodesReadOnly
        diagnoses={(note.diagnoses ?? []).map((d) => ({
          code: d.code,
          description: d.description,
          isPrimary: d.isPrimary,
          noteText: d.noteText,
        }))}
        procedures={(note.procedures ?? []).map((p) => ({
          code: p.code,
          description: p.description,
          noteText: p.noteText,
        }))}
      />
      {/* Resep terkunci tampil baca-saja pada kartu Resep di bawah */}
    </div>
  )
}

// ------------------------------------------------------------
// Dialog amandemen
// ------------------------------------------------------------

function AmendDialog({
  open,
  onOpenChange,
  note,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  note: NoteDetailDTO
  onDone: () => Promise<void>
}) {
  const [content, setContent] = useState<NoteContentDTO>(EMPTY_CONTENT)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dxRows, setDxRows] = useState<DxEditRow[]>([])
  const [prRows, setPrRows] = useState<PrEditRow[]>([])

  useEffect(() => {
    if (open && note) {
      setContent({
        subjective: note.subjective ?? '',
        allergiesNote: note.allergiesNote ?? '',
        objective: note.objective ?? '',
        supportingExam: note.supportingExam ?? '',
        assessment: note.assessment ?? '',
        plan: note.plan ?? '',
        medsGiven: note.medsGiven ?? '',
        otherServices: note.otherServices ?? '',
        education: note.education ?? '',
        followUpPlan: note.followUpPlan ?? '',
      })
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
      setReason('')
      setError(null)
    }
  }, [open, note])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await amendNoteAction(
        note.encounterId,
        content,
        reason,
        {
          diagnoses: dxRows.map((d) => ({
            icd10CodeId: d.icd10CodeId,
            isPrimary: d.isPrimary,
            noteText: d.noteText || null,
          })),
          procedures: prRows.map((p) => ({
            icd9CmCodeId: p.icd9CmCodeId,
            noteText: p.noteText || null,
          })),
        }
      )
      if (res.ok) await onDone()
      else setError(res.error ?? 'Amandemen gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Amandemen catatan terkunci</DialogTitle>
          <DialogDescription>
            Isi versi {note.versionNumber} dipertahankan sebagai riwayat (termasuk kodifikasi
            saat itu). Alasan wajib diisi dan seluruh perubahan tercatat pada jejak audit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <NoteForm content={content} setContent={setContent} disabled={false} />
          <div className="space-y-4 rounded-md border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Koreksi kodifikasi (baris lama tetap tersimpan)
            </p>
            <DiagnosisEditor rows={dxRows} onChange={setDxRows} />
            <ProcedureEditor rows={prRows} onChange={setPrRows} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amandemen-alasan">Alasan amandemen *</Label>
            <Input
              id="amandemen-alasan"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. koreksi penulisan tekanan darah pada pemeriksaan."
              className="min-h-11"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
              Batal
            </Button>
            <Button type="submit" disabled={busy} className="min-h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan amandemen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
