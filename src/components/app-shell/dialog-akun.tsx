'use client'

import { useActionState, useState, useTransition } from 'react'
import { ubahSandi, keluarPerangkatLain, type ActionState } from '@/lib/modules/identity_access/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, KeyRound, TriangleAlert, CheckCircle2, MonitorX } from 'lucide-react'

const stateAwal: ActionState = {}

export function DialogUbahSandi() {
  const [terbuka, setTerbuka] = useState(false)
  const [state, action, pending] = useActionState(ubahSandi, stateAwal)

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-[44px]">
          <KeyRound className="mr-2 h-4 w-4" /> Ubah kata sandi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah kata sandi</DialogTitle>
          <DialogDescription>
            Setelah berubah, semua perangkat lain yang memakai akun ini akan keluar otomatis.
            Tindakan ini tercatat pada jejak audit.
          </DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.success ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{state.success}</AlertDescription>
          </Alert>
        ) : null}

        <form action={action} className="space-y-4" key={state.success ?? 'baru'}>
          <div className="space-y-2">
            <Label htmlFor="sandiLama">Kata sandi saat ini</Label>
            <Input id="sandiLama" name="sandiLama" type="password" required autoComplete="current-password" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sandiBaru">Kata sandi baru</Label>
            <Input id="sandiBaru" name="sandiBaru" type="password" required autoComplete="new-password" placeholder="minimal 8 karakter, huruf + angka" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="konfirmasi">Ulangi kata sandi baru</Label>
            <Input id="konfirmasi" name="konfirmasi" type="password" required autoComplete="new-password" className="h-11" />
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-[44px]">Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={pending} className="min-h-[44px]">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pending ? 'Menyimpan…' : 'Simpan sandi baru'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TombolKeluarPerangkatLain() {
  const [pending, mulai] = useTransition()
  const [pesan, setPesan] = useState<ActionState | null>(null)

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        disabled={pending}
        onClick={() =>
          mulai(async () => {
            const r = await keluarPerangkatLain()
            setPesan(r)
          })
        }
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MonitorX className="mr-2 h-4 w-4" />}
        {pending ? 'Memeriksa…' : 'Keluar dari perangkat lain'}
      </Button>
      {pesan?.success ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {pesan.success}
        </p>
      ) : null}
    </div>
  )
}
