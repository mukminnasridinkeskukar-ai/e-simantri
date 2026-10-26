'use client'

// Konfigurasi integrasi SATUSEHAT per praktik (Fase 5) + tombol proses
// antrean. Mode SIMULASI tidak mengirim apa pun ke luar — ID bersifat CONTOH.

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { simpanKonfigurasiSatusehat, prosesAntreanSekarang, type AksiState } from '@/lib/modules/integration_satusehat/config-actions'
import { Play, Save } from 'lucide-react'

export function FormKonfigSatusehat({
  config,
}: {
  config: {
    mode: string
    enabled: boolean
    baseUrl: string | null
    clientId: string | null
    locationRefId: string | null
    adaSecret: boolean
  }
}) {
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(simpanKonfigurasiSatusehat, {})
  const [aktif, setAktif] = useState(config.enabled)

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Mode integrasi</Label>
          <Select name="mode" defaultValue={config.mode}>
            <SelectTrigger className="w-full min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SIMULASI">SIMULASI — tanpa koneksi keluar (ID contoh)</SelectItem>
              <SelectItem value="SANDBOX">SANDBOX — kirim ke endpoint sandbox praktik</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="base-url">URL sandbox (bila mode SANDBOX)</Label>
          <Input id="base-url" name="baseUrl" defaultValue={config.baseUrl ?? ''} placeholder="https://…" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="client-id">Client ID sandbox</Label>
          <Input id="client-id" name="clientId" defaultValue={config.clientId ?? ''} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="client-secret">Client Secret sandbox {config.adaSecret ? '(tersimpan — biarkan kosong agar tidak berubah)' : ''}</Label>
          <Input id="client-secret" name="clientSecret" type="password" placeholder={config.adaSecret ? '••••••••' : ''} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="location-ref">Location ID SATUSEHAT (opsional)</Label>
        <Input id="location-ref" name="locationRefId" defaultValue={config.locationRefId ?? ''} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox name="enabled" value="ya" checked={aktif} onCheckedChange={(v) => setAktif(v === true)} className="mt-0.5" />
        <span>
          <strong>Aktifkan antrean</strong> — kunjungan yang dikunci akan memasukkan kejadian FHIR ke antrean pengiriman.
          {aktif ? ' (AKTIF)' : ' (nonaktif)'}
        </span>
      </label>
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
      <Button type="submit" disabled={menunggu} className="min-h-[44px] w-full sm:w-auto">
        <Save className="mr-2 h-4 w-4" /> {menunggu ? 'Menyimpan…' : 'Simpan konfigurasi'}
      </Button>
    </form>
  )
}

export function TombolProsesAntrean() {
  const router = useRouter()
  const [hasil, setHasil] = useState<string | null>(null)
  const [menunggu, setMenunggu] = useState(false)

  const proses = async () => {
    setMenunggu(true)
    setHasil(null)
    try {
      const resp = await prosesAntreanSekarang()
      setHasil(resp.success ?? resp.error ?? 'Selesai.')
      router.refresh()
    } catch {
      setHasil('Gagal memproses antrean. Lihat log server.')
    } finally {
      setMenunggu(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={proses} disabled={menunggu} className="min-h-[44px]">
        <Play className="mr-2 h-4 w-4" /> {menunggu ? 'Memproses…' : 'Proses antrean sekarang'}
      </Button>
      {hasil ? <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{hasil}</p> : null}
    </div>
  )
}
