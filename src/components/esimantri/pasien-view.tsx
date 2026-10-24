'use client'

// ============================================================
// e-SIMANTRI — Registrasi pasien (Fase 1)
// Daftar pasien milik praktik aktif, pencarian, pendaftaran,
// dan pembaruan identitas. NIK tersamarkan pada daftar.
// Pasien TIDAK dihapus; pasien ganda dinonaktifkan.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, RefreshCw, Search, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
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
import { PAYER_OPTIONS, SEX_OPTIONS, payerLabel } from '@/lib/payer'
import { roleHasPermission } from '@/lib/roles'
import type { AppStatus, PatientDetailDTO, PatientRowDTO } from '@/lib/dto'
import {
  createPatientAction,
  getPatientDetailAction,
  listPatientsAction,
  updatePatientAction,
  type PatientInput,
} from '@/server/patients'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'long' })
}

function usia(iso: string | null): string {
  if (!iso) return '—'
  const dob = new Date(iso)
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--
  return `${years} th`
}

export function PasienView({ state }: { state: Extract<AppStatus, { status: 'ready' }> }) {
  const { toast } = useToast()
  const canManage = roleHasPermission(state.context.role, 'pasien.kelola')

  const [rows, setRows] = useState<PatientRowDTO[] | null>(null)
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [detail, setDetail] = useState<PatientDetailDTO | null>(null)

  const load = useCallback(
    (term?: string) => {
      listPatientsAction(term ?? '').then((data) => setRows(data))
    },
    []
  )

  useEffect(() => {
    load('')
  }, [load])

  async function openDetail(p: PatientRowDTO) {
    const d = await getPatientDetailAction(p.id)
    if (d) setDetail(d)
    else toast({ title: 'Gagal', description: 'Data pasien tidak ditemukan.', variant: 'destructive' })
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">Pasien praktik</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Identitas pasien milik {state.context.organization.name}. Isi klinis tidak
            ditampilkan di sini — buka catatan melalui menu Catatan Klinis sesuai hak Anda.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)} className="min-h-11">
            <Plus className="h-4 w-4" /> Daftarkan pasien
          </Button>
        )}
      </section>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          load(q)
        }}
      >
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, no. rekam medis, atau NIK"
            className="min-h-11 pl-9"
            aria-label="Cari pasien"
          />
        </div>
        <Button type="submit" variant="outline" className="min-h-11">
          Cari
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {rows === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Tidak ada pasien yang cocok. Daftarkan pasien baru bila memang belum terdaftar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <TablePasien rows={rows} onOpen={openDetail} />
            </div>
          )}
        </CardContent>
      </Card>

      <PatientFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
        onDone={() => {
          setAddOpen(false)
          load(q)
        }}
      />

      <PatientFormDialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        mode="edit"
        existing={detail}
        onDone={() => {
          setDetail(null)
          load(q)
        }}
      />
    </div>
  )
}

function TablePasien({
  rows,
  onOpen,
}: {
  rows: PatientRowDTO[]
  onOpen: (p: PatientRowDTO) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-40">No. RM</TableHead>
          <TableHead className="min-w-48">Nama</TableHead>
          <TableHead className="min-w-24">Usia</TableHead>
          <TableHead className="min-w-28">Jenis kelamin</TableHead>
          <TableHead className="min-w-32">NIK</TableHead>
          <TableHead className="min-w-36">Penjamin</TableHead>
          <TableHead className="min-w-32">Kunjungan terakhir</TableHead>
          <TableHead className="min-w-20">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow
            key={p.id}
            className="cursor-pointer"
            onClick={() => onOpen(p)}
            title="Klik untuk membuka detail"
          >
            <TableCell className="font-mono text-xs">{p.mrn}</TableCell>
            <TableCell>
              <p className="font-medium">{p.fullName}</p>
              <p className="text-xs text-muted-foreground">{p.phone ?? '—'}</p>
            </TableCell>
            <TableCell className="text-sm">{usia(p.dateOfBirth)}</TableCell>
            <TableCell className="text-sm">
              {SEX_OPTIONS.find((s) => s.value === p.sex)?.label ?? '—'}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {p.nationalIdMasked ?? '—'}
            </TableCell>
            <TableCell className="text-sm">{payerLabel(p.payerType)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {fmtDate(p.lastEncounterAt)}
            </TableCell>
            <TableCell>
              <Badge variant={p.isActive ? 'default' : 'secondary'}>
                {p.isActive ? 'Aktif' : 'Nonaktif'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PatientFormDialog({
  open,
  onOpenChange,
  mode,
  existing,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  mode: 'create' | 'edit'
  existing?: PatientDetailDTO | null
  onDone: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<PatientInput>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && existing) {
      setForm({
        fullName: existing.fullName,
        nationalId: existing.nationalId ?? '',
        dateOfBirth: existing.dateOfBirth ? existing.dateOfBirth.slice(0, 10) : '',
        sex: existing.sex ?? '',
        phone: existing.phone ?? '',
        address: existing.address ?? '',
        payerType: existing.payerType,
        payerNumber: existing.payerNumber ?? '',
        notes: existing.notes ?? '',
      })
    } else {
      setForm(emptyForm)
    }
    setError(null)
    setReady(true)
  }, [open, mode, existing])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res =
        mode === 'create'
          ? await createPatientAction(form)
          : existing
            ? await updatePatientAction(existing.id, form)
            : { ok: false, error: 'Data pasien tidak tersedia.' }
      if (res.ok) {
        toast({ title: 'Berhasil', description: res.message })
        onDone()
      } else {
        setError(res.error ?? 'Gagal menyimpan data pasien.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Daftarkan pasien baru' : `Ubah data pasien — ${existing?.mrn ?? ''}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Nomor rekam medis diberikan otomatis berurutan per praktik. NIK bersifat opsional namun membantu mencegah pasien ganda.'
              : 'Identitas pasien diperbarui tanpa menghapus riwayat kunjungan dan catatan klinisnya.'}
          </DialogDescription>
        </DialogHeader>
        {ready && (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pt-nama">Nama lengkap *</Label>
                <Input
                  id="pt-nama"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-nik">NIK (16 angka, opsional)</Label>
                <Input
                  id="pt-nik"
                  value={form.nationalId ?? ''}
                  onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                  inputMode="numeric"
                  maxLength={16}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-dob">Tanggal lahir</Label>
                <Input
                  id="pt-dob"
                  type="date"
                  value={form.dateOfBirth ?? ''}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Jenis kelamin</Label>
                <Select
                  value={form.sex ?? ''}
                  onValueChange={(v) => setForm({ ...form, sex: v })}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEX_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-telp">Nomor telepon</Label>
                <Input
                  id="pt-telp"
                  value={form.phone ?? ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pt-alamat">Alamat</Label>
                <Textarea
                  id="pt-alamat"
                  value={form.address ?? ''}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Penjamin</Label>
                <Select
                  value={form.payerType ?? 'UMUM'}
                  onValueChange={(v) => setForm({ ...form, payerType: v })}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYER_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pt-nopay">Nomor kartu penjamin</Label>
                <Input
                  id="pt-nopay"
                  value={form.payerNumber ?? ''}
                  onChange={(e) => setForm({ ...form, payerNumber: e.target.value })}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pt-catatan">Catatan administratif</Label>
                <Textarea
                  id="pt-catatan"
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Bukan tempat isi klinis — mis. cara menghubungi, preferensi jadwal."
                  className="min-h-11"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
                Batal
              </Button>
              <Button type="submit" disabled={busy} className="min-h-11">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

const emptyForm: PatientInput = {
  fullName: '',
  nationalId: '',
  dateOfBirth: '',
  sex: '',
  phone: '',
  address: '',
  payerType: 'UMUM',
  payerNumber: '',
  notes: '',
}
