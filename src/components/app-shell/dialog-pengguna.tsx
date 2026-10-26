'use client'

import { useActionState, useState } from 'react'
import {
  tambahPengguna,
  ubahPeranPengguna,
  ubahStatusPengguna,
  resetSandiPengguna,
} from '@/lib/modules/identity_access/user-actions'
import { PROFESI_OPTIONS } from '@/lib/modules/identity_access/profesi'
import type { ActionState } from '@/lib/modules/identity_access/actions'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_ORDER, type Role } from '@/lib/modules/identity_access/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, UserPlus, TriangleAlert, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react'

const stateAwal: ActionState = {}

function PesanStatus({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    )
  }
  if (state.success) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    )
  }
  return null
}

function DaftarPeranCheckbox({ terpilih, disabled }: { terpilih: Role[]; disabled?: boolean }) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      {ROLE_ORDER.map((r) => (
        <div key={r} className="flex items-start gap-3">
          <Checkbox
            id={`peran-${r}`}
            name="roles"
            value={r}
            defaultChecked={terpilih.includes(r)}
            disabled={disabled}
            className="mt-0.5"
          />
          <Label htmlFor={`peran-${r}`} className="cursor-pointer">
            <span className="text-sm font-medium leading-none">{ROLE_LABELS[r]}</span>
            <span className="mt-1 block text-xs text-muted-foreground font-normal leading-relaxed">
              {ROLE_DESCRIPTIONS[r]}
            </span>
          </Label>
        </div>
      ))}
    </div>
  )
}

// ---------- TAMBAH PENGGUNA ----------

export function DialogTambahPengguna() {
  const [terbuka, setTerbuka] = useState(false)
  const [state, action, pending] = useActionState(tambahPengguna, stateAwal)

  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px]">
          <UserPlus className="mr-2 h-4 w-4" /> Tambah pengguna
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto scroll-halus sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah pengguna pada praktik ini</DialogTitle>
          <DialogDescription>
            Surel yang sudah pernah terdaftar akan dipakai ulang sebagai akun dan hanya
            ditambahkan sebagai keanggotaan baru di praktik ini.
          </DialogDescription>
        </DialogHeader>

        <PesanStatus state={state} />

        <form action={action} className="space-y-4" key={state.success ?? 'baru'}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Nama lengkap *</Label>
            <Input id="fullName" name="fullName" required placeholder="Contoh: dr. Siti Rahma" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Surel *</Label>
            <Input id="email" name="email" type="email" required placeholder="nama@contoh.id" className="h-11" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profession">Profesi</Label>
              <select
                id="profession"
                name="profession"
                className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
                defaultValue=""
              >
                <option value="">— pilih —</option>
                {PROFESI_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telepon</Label>
              <Input id="phone" name="phone" className="h-11" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="strNumber">Nomor STR</Label>
              <Input id="strNumber" name="strNumber" placeholder="bila ada" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sipNumber">Nomor SIP / SIPP</Label>
              <Input id="sipNumber" name="sipNumber" placeholder="bila ada" className="h-11" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Kata sandi awal *</Label>
            <Input id="password" name="password" type="text" required placeholder="minimal 8 karakter, huruf + angka" className="h-11" />
          </div>

          <div className="space-y-2">
            <Label>Peran pada praktik ini *</Label>
            <DaftarPeranCheckbox terpilih={['PENDAFTARAN']} />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-[44px]">Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={pending} className="min-h-[44px]">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pending ? 'Menyimpan…' : 'Tambahkan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- UBAH PERAN ----------

export function DialogUbahPeran({
  membershipId,
  nama,
  peranSaatIni,
  peranSendiri,
}: {
  membershipId: string
  nama: string
  peranSaatIni: Role[]
  peranSendiri: boolean
}) {
  const [state, action, pending] = useActionState(ubahPeranPengguna, stateAwal)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-[44px] w-full sm:w-auto" disabled={peranSendiri}>
          <ShieldCheck className="mr-1.5 h-4 w-4" /> Ubah peran
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto scroll-halus sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah peran — {nama}</DialogTitle>
          <DialogDescription>
            {peranSendiri
              ? 'Peran akun sendiri tidak boleh diubah oleh akun sendiri. Minta Penanggung Jawab lain melakukan perubahan.'
              : 'Peran mengikuti kewenangan hukum profesi. Sistem tidak memperluas kewenangan secara diam-diam.'}
          </DialogDescription>
        </DialogHeader>

        <PesanStatus state={state} />

        <form action={action} className="space-y-4">
          <input type="hidden" name="membershipId" value={membershipId} />
          <input type="hidden" name="nama" value={nama} />
          <DaftarPeranCheckbox terpilih={peranSaatIni} disabled={peranSendiri} />
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-[44px]">Tutup</Button>
            </DialogClose>
            {!peranSendiri ? (
              <Button type="submit" disabled={pending} className="min-h-[44px]">
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {pending ? 'Menyimpan…' : 'Simpan peran'}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------- AKTIF / NONAKTIF ----------

export function DialogStatusPengguna({
  membershipId,
  nama,
  statusSaatIni,
  peranSendiri,
}: {
  membershipId: string
  nama: string
  statusSaatIni: string
  peranSendiri: boolean
}) {
  const [state, action, pending] = useActionState(ubahStatusPengguna, stateAwal)
  const menonaktifkan = statusSaatIni === 'AKTIF'

  const isi = (
    <form action={action} className="space-y-4">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="status" value={menonaktifkan ? 'NONAKTIF' : 'AKTIF'} />
      <DialogFooter className="gap-2">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="min-h-[44px]">Batal</Button>
        </DialogClose>
        <Button type="submit" disabled={pending} variant={menonaktifkan ? 'destructive' : 'default'} className="min-h-[44px]">
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {menonaktifkan ? 'Nonaktifkan keanggotaan' : 'Aktifkan kembali'}
        </Button>
      </DialogFooter>
    </form>
  )

  if (menonaktifkan) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="min-h-[44px] w-full sm:w-auto" disabled={peranSendiri}>
            Nonaktifkan
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan {nama}?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengguna tidak dapat masuk menggunakan keanggotaan pada praktik ini, dan sesi
              yang memakai praktik ini dimatikan. Tidak ada data yang dihapus — jejak audit
              tetap tersimpan. Tindakan ini tercatat pada jejak audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <PesanStatus state={state} />
          {isi}
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-[44px] w-full sm:w-auto" disabled={peranSendiri}>
          Aktifkan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aktifkan kembali {nama}?</DialogTitle>
          <DialogDescription>
            Keanggotaan pada praktik ini kembali aktif dan pengguna dapat masuk lagi.
          </DialogDescription>
        </DialogHeader>
        <PesanStatus state={state} />
        {isi}
      </DialogContent>
    </Dialog>
  )
}

// ---------- RESET SANDI ----------

export function DialogResetSandi({ membershipId, nama }: { membershipId: string; nama: string }) {
  const [state, action, pending] = useActionState(resetSandiPengguna, stateAwal)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-[44px] w-full sm:w-auto">
          <KeyRound className="mr-1.5 h-4 w-4" /> Atur sandi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atur ulang kata sandi — {nama}</DialogTitle>
          <DialogDescription>
            Seluruh sesi pengguna ini ditutup agar kata sandi lama tidak berlaku. Sampaikan
            kata sandi baru melalui saluran yang aman.
          </DialogDescription>
        </DialogHeader>
        <PesanStatus state={state} />
        <form action={action} className="space-y-4" key={state.success ?? 'baru'}>
          <input type="hidden" name="membershipId" value={membershipId} />
          <div className="space-y-2">
            <Label htmlFor={`sandi-${membershipId}`}>Kata sandi baru *</Label>
            <Input
              id={`sandi-${membershipId}`}
              name="sandiBaru"
              type="text"
              required
              placeholder="minimal 8 karakter, huruf + angka"
              className="h-11"
            />
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-[44px]">Batal</Button>
            </DialogClose>
            <Button type="submit" disabled={pending} className="min-h-[44px]">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pending ? 'Menyimpan…' : 'Atur sandi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ROLES }
