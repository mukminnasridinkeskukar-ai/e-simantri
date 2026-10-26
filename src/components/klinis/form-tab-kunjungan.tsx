'use client'

// Formulir tab kunjungan: diagnosa (ICD-10 wajib), tindakan (+persetujuan),
// resep (multi-item dengan KFA), persetujuan, tagihan, rujukan.

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Plus, ClipboardList, Pill, FileSignature, Receipt, Send } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { tambahDiagnosa, tambahTindakan, type AksiState } from '@/lib/modules/procedure/tindakan-actions'
import { simpanResep } from '@/lib/modules/medication/resep-actions'
import { catatPersetujuan } from '@/lib/modules/consent/consent-actions'
import { buatTagihan } from '@/lib/modules/billing_claim/klaim-actions'
import { buatRujukan } from '@/lib/modules/referral/rujukan-actions'
import { formatRupiah } from '@/lib/modules/konstanta'

function PakaiAksi(aksi: (p: AksiState, fd: FormData) => Promise<AksiState>, alihkan?: string) {
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(aksi, {})
  const router = useRouter()
  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => router.refresh(), 800)
      return () => clearTimeout(t)
    }
  }, [state, router, alihkan])
  return { state, formAction, menunggu }
}

function Pesan({ state }: { state: AksiState }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
    </>
  )
}

// ---------------- Diagnosa ----------------

export function FormDiagnosa({ encounterId, icd10 }: { encounterId: string; icd10: Array<{ code: string; display: string }> }) {
  const { state, formAction, menunggu } = PakaiAksi(tambahDiagnosa)
  const [pilihan, setPilihan] = useState('')
  const terpilih = icd10.find((c) => c.code === pilihan)
  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="encounterId" value={encounterId} />
      <input type="hidden" name="icd10Code" value={terpilih?.code ?? ''} />
      <input type="hidden" name="display" value={terpilih?.display ?? ''} />
      <p className="flex items-center gap-2 text-sm font-medium">
        <ClipboardList className="h-4 w-4" /> Tambah diagnosa (wajib kode ICD-10)
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Cari & pilih kode ICD-10 *</Label>
          <Select value={pilihan} onValueChange={setPilihan}>
            <SelectTrigger className="w-full min-h-[44px]">
              <SelectValue placeholder="Cari kode / istilah…" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {icd10.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.display}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Jenis diagnosa *</Label>
          <Select name="kind" defaultValue="UTAMA">
            <SelectTrigger className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTAMA">Utama</SelectItem>
              <SelectItem value="SEKUNDER">Sekunder</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="note-diag">Catatan (opsional)</Label>
        <Input id="note-diag" name="note" maxLength={300} />
      </div>
      <Pesan state={state} />
      <Button type="submit" disabled={menunggu || !terpilih} className="min-h-[44px] w-full sm:w-auto">
        Tambah diagnosa
      </Button>
    </form>
  )
}

// ---------------- Tindakan ----------------

export function FormTindakan({ encounterId, icd9cm }: { encounterId: string; icd9cm: Array<{ code: string; display: string }> }) {
  const { state, formAction, menunggu } = PakaiAksi(tambahTindakan)
  const [perluPersetujuan, setPerlu] = useState(false)
  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="encounterId" value={encounterId} />
      <p className="text-sm font-medium">Tambah tindakan</p>
      <div className="grid gap-1.5">
        <Label htmlFor="nama-tindakan">Nama tindakan *</Label>
        <Input id="nama-tindakan" name="name" required minLength={3} maxLength={200} />
      </div>
      <div className="grid gap-1.5">
        <Label>Kode ICD-9-CM (opsional)</Label>
        <Select name="icd9cmCode" defaultValue="">
          <SelectTrigger className="w-full min-h-[44px]">
            <SelectValue placeholder="Tanpa kode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TANPA">Tanpa kode</SelectItem>
            {icd9cm.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} — {c.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="catatan-tindakan">Catatan pelaksanaan (opsional)</Label>
        <Textarea id="catatan-tindakan" name="note" rows={2} maxLength={500} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={perluPersetujuan} onCheckedChange={(v) => setPerlu(v === true)} className="mt-0.5" />
        <span>Tindakan ini memerlukan persetujuan pasien (akan dibuatkan catatan persetujuan otomatis)</span>
      </label>
      {perluPersetujuan ? (
        <div className="grid gap-1.5">
          <Label htmlFor="nama-pemberi">Nama pemberi persetujuan *</Label>
          <Input id="nama-pemberi" name="namaPemberiPersetujuan" minLength={3} maxLength={120} />
        </div>
      ) : null}
      <Pesan state={state} />
      <Button type="submit" disabled={menunggu} className="min-h-[44px] w-full sm:w-auto">
        <Plus className="mr-2 h-4 w-4" /> Catat tindakan
      </Button>
    </form>
  )
}

// ---------------- Resep ----------------

interface ItemResep {
  kfaCode?: string
  drugName: string
  strength?: string
  form?: string
  quantity: string
  usage: string
}

export function FormResep({ encounterId, kfa }: { encounterId: string; kfa: Array<{ code: string; display: string; extra: string | null }> }) {
  const { state, formAction, menunggu } = PakaiAksi(simpanResep)
  const [items, setItems] = useState<ItemResep[]>([])
  const [pilihanObat, setPilihanObat] = useState('')

  const obat = kfa.find((k) => k.code === pilihanObat)

  const tambahItem = () => {
    if (!obat) return
    setItems((lama) => [
      ...lama,
      { kfaCode: obat.code, drugName: obat.display, strength: obat.extra?.split(' · ')[0], form: obat.extra?.split(' · ')[1], quantity: '', usage: '' },
    ])
    setPilihanObat('')
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="encounterId" value={encounterId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <p className="flex items-center gap-2 text-sm font-medium">
        <Pill className="h-4 w-4" /> Buat resep (daftar obat contoh — kode KFA CONTOH)
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-1.5">
          <Label>Pilih obat dari daftar</Label>
          <Select value={pilihanObat} onValueChange={setPilihanObat}>
            <SelectTrigger className="w-full min-h-[44px]">
              <SelectValue placeholder="Pilih obat…" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {kfa.map((k) => (
                <SelectItem key={k.code} value={k.code}>
                  {k.display} {k.extra ? `(${k.extra})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={tambahItem} disabled={!obat} className="min-h-[44px]">
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      </div>

      {items.map((it, i) => (
        <fieldset key={i} className="rounded-md border p-3 space-y-2">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            {it.drugName} {it.strength ?? ''} {it.form ?? ''}
          </legend>
          <input type="hidden" name={`item-${i}-nama`} value={it.drugName} />
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
            <div className="grid gap-1">
              <Label htmlFor={`qty-${i}`}>Jumlah *</Label>
              <Input
                id={`qty-${i}`}
                value={it.quantity}
                onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                placeholder="mis. 15 kapsul"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`pakai-${i}`}>Aturan pakai *</Label>
              <Input
                id={`pakai-${i}`}
                value={it.usage}
                onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, usage: e.target.value } : x)))}
                placeholder="mis. 3x1 kapsul setelah makan"
              />
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-red-700" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
            <Trash2 className="mr-1 h-4 w-4" /> Hapus item
          </Button>
        </fieldset>
      ))}

      <Pesan state={state} />
      <Button type="submit" disabled={menunggu || items.length === 0} className="min-h-[44px] w-full sm:w-auto">
        <Pill className="mr-2 h-4 w-4" /> Simpan resep
      </Button>
    </form>
  )
}

// ---------------- Persetujuan ----------------

export function FormPersetujuan({ encounterId, patientId, namaPasien }: { encounterId: string; patientId: string; namaPasien: string }) {
  const { state, formAction, menunggu } = PakaiAksi(catatPersetujuan)
  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="encounterId" value={encounterId} />
      <input type="hidden" name="patientId" value={patientId} />
      <p className="flex items-center gap-2 text-sm font-medium">
        <FileSignature className="h-4 w-4" /> Catat persetujuan
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Jenis persetujuan *</Label>
          <Select name="type" defaultValue="PERSETUJUAN_UMUM">
            <SelectTrigger className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERSETUJUAN_UMUM">Persetujuan umum perawatan</SelectItem>
              <SelectItem value="TINDAKAN">Persetujuan tindakan</SelectItem>
              <SelectItem value="TELEMEDISIN">Persetujuan telemedisin</SelectItem>
              <SelectItem value="PENGAJUAN_DATA">Persetujuan pengajuan data</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Metode *</Label>
          <Select name="method" defaultValue="ELEKTRONIK">
            <SelectTrigger className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ELEKTRONIK">Elektronik</SelectItem>
              <SelectItem value="TULISAN">Tulisan (dipindai/dicatat)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="teks-persetujuan">Teks persetujuan yang disetujui *</Label>
        <Textarea
          id="teks-persetujuan"
          name="agreedText"
          rows={3}
          required
          minLength={10}
          defaultValue={`Saya setuju ${namaPasien} menerima perawatan pada praktik ini sesuai penjelasan yang diberikan.`}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="nama-persetujuan">Nama pemberi persetujuan *</Label>
          <Input id="nama-persetujuan" name="agreedByName" required minLength={3} defaultValue={namaPasien} />
        </div>
        <div className="grid gap-1.5">
          <Label>Kedudukan *</Label>
          <Select name="agreedByRole" defaultValue="PASIEN">
            <SelectTrigger className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PASIEN">Pasien sendiri</SelectItem>
              <SelectItem value="KELUARGA">Keluarga</SelectItem>
              <SelectItem value="WALI">Wali</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="saksi-persetujuan">Saksi (opsional)</Label>
          <Input id="saksi-persetujuan" name="witnessName" maxLength={120} />
        </div>
      </div>
      <Pesan state={state} />
      <Button type="submit" disabled={menunggu} className="min-h-[44px] w-full sm:w-auto">
        Catat persetujuan
      </Button>
    </form>
  )
}

// ---------------- Tagihan ----------------

export function FormTagihan({ encounterId }: { encounterId: string }) {
  const { state, formAction, menunggu } = PakaiAksi(buatTagihan)
  const [items, setItems] = useState<Array<{ deskripsi: string; qty: string; harga: string }>>([
    { deskripsi: 'Jasa pemeriksaan dokter', qty: '1', harga: '75000' },
  ])
  const total = useMemo(
    () => items.reduce((acc, it) => acc + (parseInt(it.qty, 10) || 0) * (parseInt(it.harga, 10) || 0), 0),
    [items]
  )
  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="encounterId" value={encounterId} />
      <input type="hidden" name="items" value={JSON.stringify(items.map((it) => ({ deskripsi: it.deskripsi, qty: parseInt(it.qty, 10) || 0, harga: parseInt(it.harga, 10) || 0 })))} />
      <p className="flex items-center gap-2 text-sm font-medium">
        <Receipt className="h-4 w-4" /> Buat tagihan dari kunjungan terkunci
      </p>
      {items.map((it, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[2fr_70px_1fr_40px]">
          <div className="grid gap-1">
            <Label htmlFor={`d-${i}`}>Deskripsi</Label>
            <Input id={`d-${i}`} value={it.deskripsi} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, deskripsi: e.target.value } : x)))} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`q-${i}`}>Qty</Label>
            <Input id={`q-${i}`} inputMode="numeric" value={it.qty} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`h-${i}`}>Harga (Rp)</Label>
            <Input id={`h-${i}`} inputMode="numeric" value={it.harga} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, harga: e.target.value } : x)))} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="ghost" size="icon" className="min-h-[44px] text-red-700" aria-label="Hapus item" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setItems((l) => [...l, { deskripsi: '', qty: '1', harga: '0' }])} className="min-h-[44px]">
        <Plus className="mr-1 h-4 w-4" /> Tambah baris
      </Button>
      <p className="text-sm font-semibold">Total: {formatRupiah(total)}</p>
      <Pesan state={state} />
      <Button type="submit" disabled={menunggu} className="min-h-[44px] w-full sm:w-auto">
        Terbitkan tagihan
      </Button>
    </form>
  )
}

// ---------------- Rujukan ----------------

export function FormRujukan({ encounterId }: { encounterId: string }) {
  const { state, formAction, menunggu } = PakaiAksi(buatRujukan)
  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="encounterId" value={encounterId} />
      <p className="flex items-center gap-2 text-sm font-medium">
        <Send className="h-4 w-4" /> Buat surat rujukan keluar
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="tujuan-rujuk">Fasilitas kesehatan tujuan *</Label>
        <Input id="tujuan-rujuk" name="destination" required minLength={3} maxLength={200} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="alasan-rujuk">Alasan rujukan *</Label>
        <Textarea id="alasan-rujuk" name="reason" rows={2} required minLength={5} maxLength={500} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="catatan-rujuk">Catatan untuk penerima rujukan (opsional)</Label>
        <Textarea id="catatan-rujuk" name="notes" rows={2} maxLength={500} />
      </div>
      <Pesan state={state} />
      <Button type="submit" disabled={menunggu} className="min-h-[44px] w-full sm:w-auto">
        Buat rujukan
      </Button>
    </form>
  )
}
