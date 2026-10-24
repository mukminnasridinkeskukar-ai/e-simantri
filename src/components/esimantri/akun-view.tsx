'use client'

// ============================================================
// e-SIMANTRI — Akun & keamanan pribadi (Fase 0)
// Ubah kata sandi, verifikasi dua langkah (TOTP), dan sesi aktif.
// Keluar dari perangkat bersama harus mudah — sesi dapat dicabut.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  ShieldOff,
  ShieldPlus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  changePasswordAction,
  confirm2faAction,
  disable2faAction,
  listSessionsAction,
  revokeSessionAction,
  start2faSetupAction,
} from '@/server/actions'
import type { AppStatus, SessionRowDTO } from '@/lib/dto'

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function AkunView({
  state,
  onRefresh,
}: {
  state: Extract<AppStatus, { status: 'ready' }>
  onRefresh: () => Promise<void>
}) {
  const { toast } = useToast()
  const me = state.me

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-lg font-semibold sm:text-xl">Akun & keamanan</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Kelola kata sandi, verifikasi dua langkah, dan perangkat yang sedang masuk. Peran klinis
          dan penanggung jawab sangat disarankan mengaktifkan verifikasi dua langkah.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil akun</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nama</p>
            <p className="font-medium">{me.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{me.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Profesi</p>
            <p className="font-medium">{me.profession ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Peran aktif di praktik ini</p>
            <p className="font-medium">{state.context.role}</p>
          </div>
        </CardContent>
      </Card>

      <PasswordCard />

      <TwoFaCard enabled={me.totpEnabled} onChanged={onRefresh} />

      <SessionsCard />
    </div>
  )
}

function PasswordCard() {
  const { toast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) {
      toast({
        title: 'Gagal',
        description: 'Konfirmasi kata sandi baru tidak sama.',
        variant: 'destructive',
      })
      return
    }
    setBusy(true)
    try {
      const res = await changePasswordAction(current, next)
      if (res.ok) {
        toast({ title: 'Berhasil', description: res.message })
        setCurrent('')
        setNext('')
        setConfirm('')
      } else {
        toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" /> Ubah kata sandi
        </CardTitle>
        <CardDescription>
          Mengubah kata sandi mencabut sesi pada perangkat lain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Kata sandi saat ini</Label>
            <Input
              id="pw-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">Kata sandi baru</Label>
            <Input
              id="pw-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              placeholder="Minimal 8 karakter, huruf + angka"
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Ulangi kata sandi baru</Label>
            <Input
              id="pw-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="min-h-11"
            />
          </div>
          <Button type="submit" disabled={busy} className="min-h-11 sm:w-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan kata sandi
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function TwoFaCard({ enabled, onChanged }: { enabled: boolean; onChanged: () => Promise<void> }) {
  const { toast } = useToast()
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [disablePw, setDisablePw] = useState('')

  async function startSetup() {
    setBusy(true)
    try {
      const res = await start2faSetupAction()
      if (res.ok) {
        setSetup({ qrDataUrl: res.qrDataUrl, secret: res.secret })
        setCode('')
      } else {
        toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await confirm2faAction(code)
      if (res.ok) {
        toast({ title: 'Berhasil', description: res.message })
        setSetup(null)
        await onChanged()
      } else {
        toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function doDisable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await disable2faAction(disablePw)
      if (res.ok) {
        toast({ title: 'Berhasil', description: res.message })
        setDisableOpen(false)
        setDisablePw('')
        await onChanged()
      } else {
        toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BadgeCheck className="h-4 w-4 text-primary" /> Verifikasi dua langkah (TOTP)
        </CardTitle>
        <CardDescription>
          Lapisan kedua saat masuk: kode 6 digit dari aplikasi autentikator (mis. Google
          Authenticator).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={enabled ? 'default' : 'secondary'}>
            {enabled ? 'Aktif' : 'Belum aktif'}
          </Badge>
          {!enabled && (
            <Button onClick={startSetup} disabled={busy} className="min-h-11">
              <ShieldPlus className="h-4 w-4" /> Aktifkan
            </Button>
          )}
          {enabled && (
            <Button variant="outline" onClick={() => setDisableOpen(true)} className="min-h-11">
              <ShieldOff className="h-4 w-4" /> Matikan
            </Button>
          )}
        </div>

        {setup && !enabled && (
          <form onSubmit={confirmSetup} className="space-y-3 rounded-lg border bg-secondary/40 p-4">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <img
                src={setup.qrDataUrl}
                alt="Kode QR pendaftaran aplikasi autentikator"
                className="h-44 w-44 rounded-md border bg-white p-1"
              />
              <div className="space-y-1.5 text-sm">
                <p className="font-medium">1. Pindai QR ini</p>
                <p className="text-muted-foreground">
                  Gunakan aplikasi autentikator di ponsel Anda.
                </p>
                <p className="font-medium">2. Atau masukkan kunci manual</p>
                <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                  {setup.secret}
                </code>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">3. Masukkan kode dari aplikasi untuk konfirmasi</p>
              <InputOTP maxLength={6} value={code} onChange={setCode} disabled={busy}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || code.length < 6} className="min-h-11">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Konfirmasi aktivasi
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSetup(null)}
                className="min-h-11"
              >
                Batal
              </Button>
            </div>
          </form>
        )}
      </CardContent>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Matikan verifikasi dua langkah</DialogTitle>
            <DialogDescription>
              Masukkan kata sandi untuk konfirmasi. Akun menjadi lebih rentan tanpa 2FA.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={doDisable} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="df-pass">Kata sandi</Label>
              <Input
                id="df-pass"
                type="password"
                value={disablePw}
                onChange={(e) => setDisablePw(e.target.value)}
                required
                className="min-h-11"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDisableOpen(false)}
                className="min-h-11"
              >
                Batal
              </Button>
              <Button type="submit" disabled={busy} variant="destructive" className="min-h-11">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Matikan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SessionsCard() {
  const { toast } = useToast()
  const [rows, setRows] = useState<SessionRowDTO[] | null>(null)
  const [reload, setReload] = useState(0)

  const load = useCallback(() => setReload((n) => n + 1), [])

  useEffect(() => {
    let active = true
    listSessionsAction().then((data) => {
      if (active) setRows(data)
    })
    return () => {
      active = false
    }
  }, [reload])

  async function revoke(id: string) {
    const res = await revokeSessionAction(id, false)
    if (res.ok) {
      toast({ title: 'Berhasil', description: res.message })
      load()
    } else {
      toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
    }
  }

  async function revokeAll() {
    const res = await revokeSessionAction('', true)
    if (res.ok) {
      toast({ title: 'Berhasil', description: res.message })
      load()
    } else {
      toast({ title: 'Gagal', description: res.error, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="h-4 w-4 text-primary" /> Sesi aktif saya
          </CardTitle>
          <CardDescription>
            Perangkat yang sedang masuk dengan akun ini. Sesi kedaluwarsa otomatis (maks. 12 jam;
            60 menit tanpa aktivitas).
          </CardDescription>
        </div>
        <Button variant="outline" onClick={revokeAll} className="min-h-11 shrink-0">
          <Trash2 className="h-4 w-4" /> Cabut semua sesi lain
        </Button>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {s.current ? 'Perangkat ini' : 'Perangkat lain'}
                    {s.current && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Sesi saat ini
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={s.userAgent ?? ''}>
                    {s.userAgent ?? 'Perangkat tidak dikenal'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Masuk {fmt(s.createdAt)} • aktif {fmt(s.lastSeenAt)} • IP {s.ip ?? '—'}
                  </p>
                </div>
                {!s.current && (
                  <Button variant="outline" size="sm" onClick={() => revoke(s.id)} className="min-h-11">
                    <Trash2 className="h-4 w-4" /> Cabut
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
