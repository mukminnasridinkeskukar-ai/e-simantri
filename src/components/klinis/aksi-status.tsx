'use client'

// Tombol transisi status kunjungan (Fase 1 & 2) — mulai, selesaikan,
// kunci (dengan laporan kelengkapan), buka kunci PJ + alasan, batal.

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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { mulaiPemeriksaan, selesaikanPemeriksaan, batalkanPendaftaran } from '@/lib/modules/encounter/encounter-actions'
import { kunciKunjungan, bukaKunjungan, type AksiState } from '@/lib/modules/clinical_document/doc-actions'
import { Lock, LockOpen, Play, CheckCircle2, XCircle } from 'lucide-react'

function DialogSederhana({
  pemicu,
  judul,
  deskripsi,
  labelAksi,
  namaField,
  labelField,
  wajibMinimal,
  aksi,
  encounterId,
  ikon,
  berbahaya,
}: {
  pemicu: React.ReactNode
  judul: string
  deskripsi: string
  labelAksi: string
  namaField: string
  labelField: string
  wajibMinimal: number
  aksi: (prev: AksiState, fd: FormData) => Promise<AksiState>
  encounterId: string
  ikon: React.ReactNode
  berbahaya?: boolean
}) {
  const [terbuka, setTerbuka] = useState(false)
  const router = useRouter()
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
      <DialogTrigger asChild>{pemicu}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription>{deskripsi}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="encounterId" value={encounterId} />
          <div className="grid gap-1.5">
            <Label htmlFor={`f-${namaField}`}>{labelField} *</Label>
            <Textarea id={`f-${namaField}`} name={namaField} rows={3} required minLength={wajibMinimal} />
          </div>
          {state.error ? (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.error}
              {state.kurang && state.kurang.length > 0 ? (
                <ul className="mt-1 list-disc pl-5">
                  {state.kurang.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {state.success ? (
            <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {state.success}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={menunggu} variant={berbahaya ? 'destructive' : 'default'} className="min-h-[44px] w-full sm:w-auto">
              {ikon}
              {menunggu ? 'Memproses…' : labelAksi}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TombolMulai({ encounterId }: { encounterId: string }) {
  const router = useRouter()
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(mulaiPemeriksaan, {})
  useEffect(() => {
    if (state.success) router.refresh()
  }, [state, router])
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="encounterId" value={encounterId} />
      <Button type="submit" disabled={menunggu} className="min-h-[44px]">
        <Play className="mr-2 h-4 w-4" /> Mulai pemeriksaan
      </Button>
    </form>
  )
}

export function TombolSelesai({ encounterId }: { encounterId: string }) {
  const router = useRouter()
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(selesaikanPemeriksaan, {})
  useEffect(() => {
    if (state.success) router.refresh()
  }, [state, router])
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="encounterId" value={encounterId} />
      <Button type="submit" disabled={menunggu} className="min-h-[44px]">
        <CheckCircle2 className="mr-2 h-4 w-4" /> Selesaikan pemeriksaan
      </Button>
    </form>
  )
}

export function TombolKunci({
  encounterId,
  kelengkapan,
}: {
  encounterId: string
  kelengkapan: string[]
}) {
  const penuh = kelengkapan.length === 0
  return (
    <DialogSederhana
      pemicu={
        <Button className="min-h-[44px]" variant={penuh ? 'default' : 'outline'}>
          <Lock className="mr-2 h-4 w-4" /> Kunci kunjungan
        </Button>
      }
      judul="Kunci kunjungan"
      deskripsi={
        penuh
          ? 'Kelengkapan field wajib rawat jalan sudah terpenuhi. Mengunci membuat catatan tidak dapat diubah lagi dan (bila integrasi aktif) memasukkan data ke antrean SATUSEHAT.'
          : `Kelengkapan belum penuh (${kelengkapan.length} item). Penguncian akan ditolak server sampai lengkap.`
      }
      labelAksi="Kunci sekarang"
      namaField="konfirmasi"
      labelField={'Tulis "SAAT INI" untuk konfirmasi (tidak disimpan ke catatan)'}
      wajibMinimal={7}
      aksi={async (prev, fd) => {
        if (String(fd.get('konfirmasi') ?? '').trim().toUpperCase() !== 'SAAT INI') {
          return { error: 'Konfirmasi tidak cocok. Tulis SAAT INI.' }
        }
        return kunciKunjungan(prev, fd)
      }}
      encounterId={encounterId}
      ikon={<Lock className="mr-2 h-4 w-4" />}
    />
  )
}

export function TombolBukaKunci({ encounterId }: { encounterId: string }) {
  return (
    <DialogSederhana
      pemicu={
        <Button variant="outline" className="min-h-[44px]">
          <LockOpen className="mr-2 h-4 w-4" /> Buka kunci (koreksi)
        </Button>
      }
      judul="Buka kunci kunjungan"
      deskripsi="Hanya Penanggung Jawab. Alasan wajib dan seluruh pembukaan tercatat di jejak audit. Koreksi dilakukan dengan versi baru, bukan menghapus isi."
      labelAksi="Buka kunci"
      namaField="reason"
      labelField="Alasan koreksi *"
      wajibMinimal={10}
      aksi={bukaKunjungan}
      encounterId={encounterId}
      ikon={<LockOpen className="mr-2 h-4 w-4" />}
    />
  )
}

export function TombolBatal({ encounterId }: { encounterId: string }) {
  return (
    <DialogSederhana
      pemicu={
        <Button variant="ghost" className="min-h-[44px] text-red-700 hover:bg-red-50">
          <XCircle className="mr-2 h-4 w-4" /> Batalkan pendaftaran
        </Button>
      }
      judul="Batalkan pendaftaran"
      deskripsi="Hanya sebelum pemeriksaan dimulai. Tidak ada data yang dihapus — status menjadi Batal dengan alasan yang tercatat."
      labelAksi="Batalkan"
      namaField="reason"
      labelField="Alasan pembatalan *"
      wajibMinimal={5}
      aksi={batalkanPendaftaran}
      encounterId={encounterId}
      ikon={<XCircle className="mr-2 h-4 w-4" />}
      berbahaya
    />
  )
}
