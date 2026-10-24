'use client'

// ============================================================
// e-SIMANTRI — Pengguna & peran dalam praktik (Fase 0)
// Tambah pengguna, ubah peran keanggotaan, aktif/nonaktif.
// Penugasan peran dibatasi aturan kewenangan (canGrantRole).
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ShieldAlert, UserX, UserCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  GRANTABLE_ROLES,
  ROLE_LABELS,
  ROLE_SHORT,
  type RoleKey,
} from '@/lib/roles'
import {
  changeMembershipRoleAction,
  createUserAction,
  listUsersAction,
  setUserActiveAction,
} from '@/server/actions'
import type { AppStatus, UserRowDTO } from '@/lib/dto'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function PenggunaView({ state }: { state: Extract<AppStatus, { status: 'ready' }> }) {
  const { toast } = useToast()
  const myRole = state.context.role as RoleKey
  const canManage = myRole === 'PENANGGUNG_JAWAB' || myRole === 'ADMIN_TEKNIS'

  const [rows, setRows] = useState<UserRowDTO[] | null>(null)
  const [reload, setReload] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState<{ user: UserRowDTO; membershipId: string; role: RoleKey } | null>(null)
  const [activeTarget, setActiveTarget] = useState<{ user: UserRowDTO; next: boolean } | null>(null)

  const load = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let active = true
    listUsersAction().then((data) => {
      if (active) setRows(data)
    })
    return () => {
      active = false
    }
  }, [reload])

  async function handleRoleChange(newRole: RoleKey) {
    if (!roleTarget) return
    const res = await changeMembershipRoleAction(roleTarget.membershipId, newRole)
    if (res.ok) {
      toast({ title: 'Peran diperbarui', description: res.message })
      setRoleTarget(null)
      load()
    } else {
      toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
    }
  }

  async function handleSetActive() {
    if (!activeTarget) return
    const res = await setUserActiveAction(activeTarget.user.id, activeTarget.next)
    if (res.ok) {
      toast({ title: 'Berhasil', description: res.message })
      setActiveTarget(null)
      load()
    } else {
      toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">Pengguna praktik</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Pengguna beserta perannya di {state.context.organization.name}. Satu orang boleh
            memegang lebih dari satu peran; peran di praktik lain tidak terlihat di sini.
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} className="min-h-11">
              <RefreshCw className="h-4 w-4" /> Muat ulang
            </Button>
            <Button onClick={() => setAddOpen(true)} className="min-h-11">
              <Plus className="h-4 w-4" /> Tambah pengguna
            </Button>
          </div>
        )}
      </section>

      {canManage && (
        <div className="flex items-start gap-2 rounded-lg border bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Aturan penugasan: hanya <b>Penanggung Jawab Praktik</b> dapat menetapkan peran klinis
            (PPA, PPA Pendamping) dan Penanggung Jawab lain; <b>Admin Teknis</b> hanya dapat
            menetapkan peran operasional. Peran klinis menuntut profesi dan nomor STR/SIP. Hak
            tidak boleh diperluas melebihi kewenangan hukum.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {rows === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Belum ada pengguna selain Anda. Tambahkan staf sesuai kebutuhan praktik.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-44">Nama</TableHead>
                    <TableHead className="min-w-48">Email</TableHead>
                    <TableHead className="min-w-40">Profesi / STR</TableHead>
                    <TableHead className="min-w-44">Peran di praktik ini</TableHead>
                    <TableHead className="min-w-32">Sesi terakhir</TableHead>
                    <TableHead className="min-w-20">Status</TableHead>
                    {canManage && <TableHead className="min-w-24 text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-medium">{u.fullName}</p>
                        {u.totpEnabled && (
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            2FA aktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-sm">
                        {u.profession ?? '—'}
                        {u.strNumber && (
                          <p className="text-xs text-muted-foreground">STR: {u.strNumber}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <button
                              key={r.membershipId}
                              type="button"
                              disabled={!canManage}
                              onClick={() => canManage && setRoleTarget({ user: u, membershipId: r.membershipId, role: r.role })}
                              title={canManage ? 'Klik untuk mengubah peran' : undefined}
                              className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/60 hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                            >
                              {ROLE_SHORT[r.role as RoleKey]}
                              {!r.isActive && ' (nonaktif)'}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(u.lastSessionAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? 'default' : 'secondary'}>
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {u.id !== state.me.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-11"
                              onClick={() => setActiveTarget({ user: u, next: !u.isActive })}
                            >
                              {u.isActive ? (
                                <UserX className="h-4 w-4" aria-label="Nonaktifkan" />
                              ) : (
                                <UserCheck className="h-4 w-4" aria-label="Aktifkan" />
                              )}
                              <span className="ml-1 text-xs">{u.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog tambah pengguna */}
      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        myRole={myRole}
        onDone={() => {
          setAddOpen(false)
          load()
        }}
      />

      {/* Dialog ubah peran */}
      <Dialog open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah peran keanggotaan</DialogTitle>
            <DialogDescription>
              {roleTarget?.user.fullName} — peran saat ini:{' '}
              {roleTarget ? ROLE_LABELS[roleTarget.role] : ''}
            </DialogDescription>
          </DialogHeader>
          <RoleChangeBody
            current={roleTarget?.role}
            myRole={myRole}
            onSubmit={handleRoleChange}
          />
        </DialogContent>
      </Dialog>

      {/* Konfirmasi aktif/nonaktif */}
      <AlertDialog open={!!activeTarget} onOpenChange={(o) => !o && setActiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {activeTarget?.next ? 'Aktifkan pengguna?' : 'Nonaktifkan pengguna?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activeTarget?.next
                ? 'Pengguna akan dapat masuk kembali dengan peran yang sudah ada.'
                : 'Pengguna tidak dapat masuk dan seluruh sesinya dicabut. Data tetap tersimpan; isi rekam medis tidak pernah dihapus.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              onClick={(e) => {
                e.preventDefault()
                handleSetActive()
              }}
            >
              Ya, lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RoleChangeBody({
  current,
  myRole,
  onSubmit,
}: {
  current?: RoleKey
  myRole: RoleKey
  onSubmit: (r: RoleKey) => Promise<void>
}) {
  const [role, setRole] = useState<RoleKey | ''>(current ?? '')
  const [busy, setBusy] = useState(false)
  const grantable = GRANTABLE_ROLES[myRole] ?? []

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Peran baru</Label>
        <Select value={role} onValueChange={(v) => setRole(v as RoleKey)}>
          <SelectTrigger className="min-h-11 w-full">
            <SelectValue placeholder="Pilih peran" />
          </SelectTrigger>
          <SelectContent>
            {grantable.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Pilihan terbatas sesuai hak penugasan peran Anda. Hak bisa dipersempit, tidak boleh
          diperluas melebihi kewenangan hukum.
        </p>
      </div>
      <DialogFooter>
        <Button
          className="min-h-11"
          disabled={!role || role === current || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSubmit(role as RoleKey)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan peran
        </Button>
      </DialogFooter>
    </div>
  )
}

function AddUserDialog({
  open,
  onOpenChange,
  myRole,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  myRole: RoleKey
  onDone: () => void
}) {
  const { toast } = useToast()
  const grantable = GRANTABLE_ROLES[myRole] ?? []
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    profession: '',
    strNumber: '',
    sipNumber: '',
    role: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clinicalSelected = form.role === 'PPA' || form.role === 'PPA_PENDAMPING'

  function reset() {
    setForm({ fullName: '', email: '', password: '', profession: '', strNumber: '', sipNumber: '', role: '' })
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await createUserAction({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        profession: form.profession,
        strNumber: form.strNumber,
        sipNumber: form.sipNumber,
        role: form.role,
      })
      if (res.ok) {
        toast({ title: 'Berhasil', description: res.message })
        reset()
        onDone()
      } else {
        setError(res.error ?? 'Gagal menambahkan pengguna.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah pengguna</DialogTitle>
          <DialogDescription>
            Akun baru dibuat dengan status wajib ganti kata sandi. Jika email sudah terdaftar di
            praktik lain, hanya keanggotaan di praktik ini yang ditambahkan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nu-name">Nama lengkap</Label>
              <Input
                id="nu-name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">Email</Label>
              <Input
                id="nu-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-pass">Kata sandi awal</Label>
              <Input
                id="nu-pass"
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                placeholder="Minimal 8 karakter, huruf + angka"
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Peran di praktik ini</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })} required>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue placeholder="Pilih peran" />
                </SelectTrigger>
                <SelectContent>
                  {grantable.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-prof">Profesi</Label>
              <Input
                id="nu-prof"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
                placeholder="Mis. Dokter Umum, Bidan"
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-str">Nomor STR</Label>
              <Input
                id="nu-str"
                value={form.strNumber}
                onChange={(e) => setForm({ ...form, strNumber: e.target.value })}
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nu-sip">SIP/SIPP (bila ada)</Label>
              <Input
                id="nu-sip"
                value={form.sipNumber}
                onChange={(e) => setForm({ ...form, sipNumber: e.target.value })}
                className="min-h-11"
              />
            </div>
          </div>
          {clinicalSelected && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Peran klinis menuntut profesi dan nomor STR terisi. Sistem tidak boleh membiarkan
              pengguna mengisi atau menandatangani catatan di luar kewenangannya (divalidasi
              penuh saat modul catatan klinis hadir).
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
              Batal
            </Button>
            <Button type="submit" disabled={busy} className="min-h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Tambahkan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
