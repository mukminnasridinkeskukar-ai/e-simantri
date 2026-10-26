'use client'

// Tombol pembuatan kode akses portal pasien (Fase 6).
// Kode 6 digit hanya ditampilkan SEKALI — basis data menyimpan hash.

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { KeyRound, Copy, Check } from 'lucide-react'
import { buatKodePortal, type AksiStaf } from '@/lib/modules/patient_portal/portal-actions'

export function TombolPortalPasien({
  patientId,
  namaPasien,
  adaTanggalLahir,
}: {
  patientId: string
  namaPasien: string
  adaTanggalLahir: boolean
}) {
  const [state, formAction, menunggu] = useActionState<AksiStaf, FormData>(buatKodePortal, {})
  const router = useRouter()
  const [tersalin, setTersalin] = useState(false)

  useEffect(() => {
    if (state.success) router.refresh()
  }, [state, router])

  const salin = async () => {
    if (!state.kodeBaru) return
    try {
      await navigator.clipboard.writeText(state.kodeBaru)
      setTersalin(true)
      setTimeout(() => setTersalin(false), 2000)
    } catch {
      // salin manual tetap bisa; kode tampil di layar
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      {!adaTanggalLahir ? (
        <p className="text-xs text-amber-700">Pasien belum punya tanggal lahir — isi dulu agar verifikasi portal tersedia.</p>
      ) : null}
      <Button type="submit" variant="outline" disabled={menunggu || !adaTanggalLahir} className="min-h-[44px]">
        <KeyRound className="mr-2 h-4 w-4" />
        {menunggu ? 'Membuat…' : 'Buat / atur ulang kode akses'}
      </Button>
      {state.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.kodeBaru ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-900">Kode akses untuk {namaPasien}:</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-white px-3 py-1.5 text-lg font-bold tracking-[0.3em] text-emerald-900">
              {state.kodeBaru}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={salin} className="min-h-[44px]">
              {tersalin ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="sr-only">Salin kode</span>
            </Button>
          </div>
          <p className="mt-1 text-xs text-emerald-800">
            Tampilkan sekali sekarang lalu serahkan langsung ke pasien. Kode tidak akan ditampilkan lagi — buat ulang bila hilang.
          </p>
        </div>
      ) : null}
      {state.success && !state.kodeBaru ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
    </form>
  )
}
