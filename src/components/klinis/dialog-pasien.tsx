'use client'

// Dialog formulir pasien (tambah / ubah) dengan pencarian duplikat
// yang ditegaskan server (NIK unik per praktik).

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { tambahPasien, ubahPasien, type AksiState } from '@/lib/modules/registry/pasien-actions'
import { UserPlus } from 'lucide-react'

export interface NilaiPasien {
  id?: string
  name?: string
  nik?: string | null
  dateOfBirth?: string | null // yyyy-mm-dd
  sex?: string | null
  phone?: string | null
  address?: string | null
  bloodType?: string | null
  allergiesNote?: string | null
  payerType?: string | null
  payerName?: string | null
}

export function DialogPasien({
  mode,
  nilai,
  trigger,
}: {
  mode: 'tambah' | 'ubah'
  nilai?: NilaiPasien
  trigger?: React.ReactNode
}) {
  const [terbuka, setTerbuka] = useState(false)
  const router = useRouter()
  const aksi = mode === 'tambah' ? tambahPasien : ubahPasien
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(aksi, {})

  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => {
        setTerbuka(false)
        router.refresh()
      }, 900)
      return () => clearTimeout(t)
    }
  }, [state, router])

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="min-h-[44px]">
            <UserPlus className="mr-2 h-4 w-4" /> Pasien Baru
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'tambah' ? 'Daftarkan pasien baru' : 'Ubah data pasien'}</DialogTitle>
          <DialogDescription>
            Satu pasien satu berkas per praktik. NIK bila ada akan dicek agar tidak ganda; pasien tanpa NIK tetap dapat terdaftar.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          {nilai?.id ? <input type="hidden" name="patientId" value={nilai.id} /> : null}
          <div className="grid gap-1.5">
            <Label htmlFor="nama-pasien">Nama lengkap *</Label>
            <Input id="nama-pasien" name="name" defaultValue={nilai?.name ?? ''} required minLength={3} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nik-pasien">NIK (bila diketahui)</Label>
            <Input id="nik-pasien" name="nik" inputMode="numeric" pattern="\d{16}" defaultValue={nilai?.nik ?? ''} placeholder="16 angka; kosongkan bila belum ada" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lahir-pasien">Tanggal lahir</Label>
              <Input id="lahir-pasien" name="dateOfBirth" type="date" defaultValue={nilai?.dateOfBirth ?? ''} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sex-pasien">Jenis kelamin</Label>
              <Select name="sex" defaultValue={nilai?.sex ?? 'TIDAK_DICATAT'}>
                <SelectTrigger id="sex-pasien" className="w-full">
                  <SelectValue placeholder="Pilih" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LAKI_LAKI">Laki-laki</SelectItem>
                  <SelectItem value="PEREMPUAN">Perempuan</SelectItem>
                  <SelectItem value="TIDAK_DICATAT">Tidak dicatat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="telp-pasien">Nomor telepon</Label>
              <Input id="telp-pasien" name="phone" defaultValue={nilai?.phone ?? ''} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gol-pasien">Golongan darah</Label>
              <Input id="gol-pasien" name="bloodType" defaultValue={nilai?.bloodType ?? ''} placeholder="A / B / AB / O" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="alamat-pasien">Alamat</Label>
            <Textarea id="alamat-pasien" name="address" rows={2} defaultValue={nilai?.address ?? ''} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="alergi-pasien">Riwayat alergi (ringkasan)</Label>
            <Textarea
              id="alergi-pasien"
              name="allergiesNote"
              rows={2}
              defaultValue={nilai?.allergiesNote ?? ''}
              placeholder="Tulis eksplisit; bila tidak ada tulis &quot;tidak ada riwayat alergi&quot;"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pembayar-pasien">Penanggung pembayaran</Label>
              <Select name="payerType" defaultValue={nilai?.payerType ?? 'UANG_SENDIRI'}>
                <SelectTrigger id="pembayar-pasien" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UANG_SENDIRI">Biaya sendiri</SelectItem>
                  <SelectItem value="ASURANSI">Asuransi</SelectItem>
                  <SelectItem value="LAINNYA">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pembayar-nama">Nama penjamin (bila ada)</Label>
              <Input id="pembayar-nama" name="payerName" defaultValue={nilai?.payerName ?? ''} />
            </div>
          </div>
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
          <DialogFooter>
            <Button type="submit" disabled={menunggu} className="min-h-[44px] w-full sm:w-auto">
              {menunggu ? 'Menyimpan…' : mode === 'tambah' ? 'Daftarkan pasien' : 'Simpan perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
