'use client'

// Formulir kunjungan baru (Fase 1): pilih pasien, jenis kunjungan,
// keluhan utama, penjamin. Telemedisin mewajibkan persetujuan tercatat.

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buatKunjungan, type AksiState } from '@/lib/modules/encounter/encounter-actions'
import { CalendarPlus, Search } from 'lucide-react'

export interface PilihanPasien {
  id: string
  name: string
  medicalRecordNumber: string
}

export function FormKunjunganBaru({
  pasien,
  lokasi,
}: {
  pasien: PilihanPasien[]
  lokasi: Array<{ id: string; name: string }>
}) {
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(buatKunjungan, {})
  const router = useRouter()
  const [cari, setCari] = useState('')
  const [pasienId, setPasienId] = useState('')
  const [jenis, setJenis] = useState('DATANG_SENDIRI')

  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => router.push('/kunjungan'), 900)
      return () => clearTimeout(t)
    }
  }, [state, router])

  const hasilCari = useMemo(() => {
    const kata = cari.trim().toLowerCase()
    if (!kata) return pasien.slice(0, 8)
    return pasien
      .filter((p) => `${p.name} ${p.medicalRecordNumber}`.toLowerCase().includes(kata))
      .slice(0, 8)
  }, [cari, pasien])

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="patientId" value={pasienId} />

      <div className="grid gap-2">
        <Label>Cari & pilih pasien *</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Nama atau nomor RM…"
            className="pl-9 min-h-[44px]"
            aria-label="Cari pasien"
          />
        </div>
        <div className="max-h-56 overflow-y-auto rounded-lg border divide-y">
          {hasilCari.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Tidak ada pasien cocok. Daftarkan dulu di menu Pasien.</p>
          ) : (
            hasilCari.map((p) => (
              <label
                key={p.id}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60"
              >
                <input
                  type="radio"
                  name="pilih-pasien-radio"
                  checked={pasienId === p.id}
                  onChange={() => setPasienId(p.id)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">{p.medicalRecordNumber}</span>
              </label>
            ))
          )}
        </div>
        {!pasienId ? <p className="text-xs text-muted-foreground">Pilih satu pasien dari daftar di atas.</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="jenis-kunjungan">Jenis kunjungan *</Label>
          <Select name="type" value={jenis} onValueChange={setJenis}>
            <SelectTrigger id="jenis-kunjungan" className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DATANG_SENDIRI">Datang sendiri</SelectItem>
              <SelectItem value="PERJANJIAN">Perjanjian</SelectItem>
              <SelectItem value="TELEMEDISIN">Telemedisin</SelectItem>
              <SelectItem value="KUNJUNGAN_RUMAH">Kunjungan rumah</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="penjamin-kunjungan">Penanggung pembayaran</Label>
          <Select name="paymentMethod" defaultValue="UANG_SENDIRI">
            <SelectTrigger id="penjamin-kunjungan" className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UANG_SENDIRI">Biaya sendiri</SelectItem>
              <SelectItem value="ASURANSI">Asuransi</SelectItem>
              <SelectItem value="LAINNYA">Lainnya</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {jenis === 'PERJANJIAN' ? (
        <div className="grid gap-1.5">
          <Label htmlFor="jadwal-kunjungan">Jadwal perjanjian *</Label>
          <Input id="jadwal-kunjungan" name="scheduledAt" type="datetime-local" className="min-h-[44px]" />
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="lokasi-kunjungan">Lokasi praktik</Label>
        <Select name="locationId" defaultValue={lokasi[0]?.id ?? ''}>
          <SelectTrigger id="lokasi-kunjungan" className="w-full min-h-[44px]">
            <SelectValue placeholder="Pilih lokasi" />
          </SelectTrigger>
          <SelectContent>
            {lokasi.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="keluhan-kunjungan">Keluhan utama (ringkas) *</Label>
        <Textarea
          id="keluhan-kunjungan"
          name="chiefComplaint"
          rows={2}
          required
          minLength={3}
          maxLength={200}
          placeholder="Mis. flu dan batuk 3 hari"
        />
      </div>

      {jenis === 'TELEMEDISIN' ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
          <label className="flex items-start gap-3">
            <Checkbox name="persetujuanTelemedisin" value="setuju" className="mt-0.5" />
            <span>
              Pasien <strong>menyetujui layanan telemedisin</strong>. Persetujuan akan dicatat sebagai dokumen
              persetujuan pada kunjungan ini (bisa dilihat di tab Persetujuan).
            </span>
          </label>
          <div className="grid gap-1.5">
            <Label htmlFor="catatan-tele">Catatan kanal telemedisin</Label>
            <Input id="catatan-tele" name="telemedicineNote" placeholder="Mis. video call 10 menit" />
          </div>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success} Mengalihkan ke daftar kunjungan…
        </p>
      ) : null}

      <Button type="submit" disabled={menunggu || !pasienId} className="min-h-[44px] w-full sm:w-auto">
        <CalendarPlus className="mr-2 h-4 w-4" />
        {menunggu ? 'Menyimpan…' : 'Daftarkan kunjungan'}
      </Button>
    </form>
  )
}
