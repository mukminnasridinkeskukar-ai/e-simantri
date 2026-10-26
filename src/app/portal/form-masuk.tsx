'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { masukPortal } from '@/lib/modules/patient_portal/portal-actions'
import { LogIn } from 'lucide-react'

export function FormMasukPortal() {
  const [state, formAction, menunggu] = useActionState<{ error?: string }, FormData>(masukPortal, {})
  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="kode-portal">Kode akses (6 angka)</Label>
        <Input
          id="kode-portal"
          name="kode"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          className="min-h-[48px] text-center text-lg tracking-[0.4em]"
          placeholder="••••••"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lahir-portal">Tanggal lahir (hh/bb/tttt)</Label>
        <Input id="lahir-portal" name="tanggalLahir" required placeholder="mis. 10/01/1988" className="min-h-[44px]" />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={menunggu} className="min-h-[48px]">
        <LogIn className="mr-2 h-4 w-4" /> {menunggu ? 'Memeriksa…' : 'Lihat riwayat saya'}
      </Button>
    </form>
  )
}
