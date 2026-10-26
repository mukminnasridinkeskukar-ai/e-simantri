'use client'

import { useActionState, useState } from 'react'
import { ubahProfilPraktik } from '@/lib/modules/tenant/org-actions'
import type { ActionState } from '@/lib/modules/identity_access/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2, Pencil, TriangleAlert, CheckCircle2 } from 'lucide-react'

const JENIS = [
  { value: 'DOKTER_UMUM', label: 'Praktik Dokter' },
  { value: 'DOKTER_GIGI', label: 'Praktik Dokter Gigi' },
  { value: 'NAKES_LAIN', label: 'Praktik Tenaga Kesehatan Lain' },
  { value: 'CAMPURAN', label: 'Campuran (lebih dari satu profesi)' },
]

export interface ProfilPraktikData {
  name: string
  practiceType: string
  sipNumber: string
  address: string
  phone: string
  email: string
  headName: string
}

const stateAwal: ActionState = {}

export function DialogUbahProfil({ profil }: { profil: ProfilPraktikData }) {
  const [terbuka, setTerbuka] = useState(false)
  const [state, action, pending] = useActionState(ubahProfilPraktik, stateAwal)

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px]">
          <Pencil className="mr-2 h-4 w-4" /> Ubah profil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto scroll-halus sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah profil tempat praktik</DialogTitle>
          <DialogDescription>
            Perubahan profil tercatat pada jejak audit dengan nama pelaku.
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

        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama tempat praktik *</Label>
            <Input id="name" name="name" defaultValue={profil.name} required className="h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="practiceType">Jenis praktik *</Label>
            <select
              id="practiceType"
              name="practiceType"
              defaultValue={profil.practiceType}
              required
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            >
              {JENIS.map((j) => (
                <option key={j.value} value={j.value}>{j.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sipNumber">Nomor SIP penyelenggara</Label>
            <Input id="sipNumber" name="sipNumber" defaultValue={profil.sipNumber} className="h-11" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Alamat lengkap</Label>
            <Textarea id="address" name="address" defaultValue={profil.address} rows={2} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telepon</Label>
              <Input id="phone" name="phone" defaultValue={profil.phone} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Surel praktik</Label>
              <Input id="email" name="email" type="email" defaultValue={profil.email} className="h-11" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headName">Nama penanggung jawab profesional</Label>
            <Input id="headName" name="headName" defaultValue={profil.headName} className="h-11" />
            <p className="text-xs text-muted-foreground">
              Nama ini dipakai pada kop dan dokumen resmi praktik.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-[44px]">Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={pending} className="min-h-[44px]">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pending ? 'Menyimpan…' : 'Simpan perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
