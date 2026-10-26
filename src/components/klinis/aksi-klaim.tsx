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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BadgeCheck, XCircle, FileDown } from 'lucide-react'
import { tandaiDibayar, batalkanTagihan, type AksiState } from '@/lib/modules/billing_claim/klaim-actions'

export function TombolDibayar({ invoiceId }: { invoiceId: string }) {
  const [terbuka, setTerbuka] = useState(false)
  const router = useRouter()
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(tandaiDibayar, {})
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
        <Button size="sm" className="min-h-[44px]">
          <BadgeCheck className="mr-1 h-4 w-4" /> Tandai dibayar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran tagihan</DialogTitle>
          <DialogDescription>Metode pembayaran tercatat pada tagihan dan jejak audit.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <div className="grid gap-1.5">
            <Label>Metode pembayaran *</Label>
            <Select name="paymentMethod" defaultValue="TUNAI">
              <SelectTrigger className="w-full min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TUNAI">Tunai</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="QRIS">QRIS</SelectItem>
                <SelectItem value="E-WALLET">E-Wallet</SelectItem>
                <SelectItem value="ASURANSI">Asuransi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state.error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={menunggu} className="min-h-[44px]">
              {menunggu ? 'Memproses…' : 'Konfirmasi dibayar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TombolBatalkanTagihan({ invoiceId }: { invoiceId: string }) {
  const [terbuka, setTerbuka] = useState(false)
  const router = useRouter()
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(batalkanTagihan, {})
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
          <DialogTitle>Batalkan tagihan</DialogTitle>
          <DialogDescription>Wajib beralasan. Catatan tetap tersimpan di jejak audit.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <div className="grid gap-1.5">
            <Label htmlFor="alasan-batal-tagihan">Alasan pembatalan *</Label>
            <Textarea id="alasan-batal-tagihan" name="reason" rows={2} required minLength={5} />
          </div>
          {state.error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={menunggu} variant="destructive" className="min-h-[44px]">
              {menunggu ? 'Memproses…' : 'Batalkan tagihan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TombolEksporKlaim() {
  return (
    <Button asChild variant="outline" className="min-h-[44px]">
      <a href="/api/klaim/ekspor" download>
        <FileDown className="mr-2 h-4 w-4" /> Ekspor CSV
      </a>
    </Button>
  )
}
