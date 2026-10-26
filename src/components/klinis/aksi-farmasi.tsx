'use client'

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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, XCircle } from 'lucide-react'
import { serahkanResep, batalkanResep, type AksiState } from '@/lib/modules/medication/resep-actions'

export function TombolSerahkan({ prescriptionId }: { prescriptionId: string }) {
  const router = useRouter()
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(serahkanResep, {})
  useEffect(() => {
    if (state.success) router.refresh()
  }, [state, router])
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
      <Button type="submit" disabled={menunggu} size="sm" className="min-h-[44px]">
        <CheckCircle2 className="mr-1 h-4 w-4" /> Tandai diserahkan
      </Button>
    </form>
  )
}

export function TombolBatalkanResep({ prescriptionId }: { prescriptionId: string }) {
  const [terbuka, setTerbuka] = useState(false)
  const router = useRouter()
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(batalkanResep, {})
  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => {
        setTerbuka(false)
        router.refresh()
      }, 800)
      return () => clearTimeout(t)
    }
  }, [state, router])
  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-[44px] text-red-700 hover:bg-red-50">
          <XCircle className="mr-1 h-4 w-4" /> Batalkan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batalkan resep</DialogTitle>
          <DialogDescription>
            Pembatalan wajib beralasan dan tercatat di jejak audit. Catatan resep tetap tersimpan.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="prescriptionId" value={prescriptionId} />
          <div className="grid gap-1.5">
            <Label htmlFor="alasan-batal-resep">Alasan pembatalan *</Label>
            <Textarea id="alasan-batal-resep" name="reason" rows={2} required minLength={5} />
          </div>
          {state.error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={menunggu} variant="destructive" className="min-h-[44px]">
              {menunggu ? 'Memproses…' : 'Batalkan resep'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
