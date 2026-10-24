'use client'

// ============================================================
// e-SIMANTRI — Tampilan masuk akun (Fase 0)
// Termasuk tahap verifikasi dua langkah (TOTP).
// Akun demo bersifat fiktif dan bertanda CONTOH.
// ============================================================

import { useState } from 'react'
import { Activity, KeyRound, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'
import { loginAction, verify2faAction } from '@/server/actions'

const DEMO_ACCOUNTS: { email: string; role: string; org: string }[] = [
  { email: 'andi@praktik-contoh.id', role: 'Penanggung Jawab + PPA', org: 'Praktik Dokter (CONTOH)' },
  { email: 'sari@praktik-contoh.id', role: 'PPA Pendamping', org: 'Praktik Dokter (CONTOH)' },
  { email: 'rina@praktik-contoh.id', role: 'Petugas Pendaftaran', org: 'Praktik Dokter (CONTOH)' },
  { email: 'tono@praktik-contoh.id', role: 'Petugas Rekam Medis', org: 'Praktik Dokter (CONTOH)' },
  { email: 'budi@praktik-contoh.id', role: 'Kasir / Klaim', org: 'Praktik Dokter (CONTOH)' },
  { email: 'admin@praktik-contoh.id', role: 'Admin Teknis', org: 'Praktik Dokter (CONTOH)' },
  { email: 'dewi@praktik-contoh.id', role: 'Penanggung Jawab + PPA', org: 'Praktik Bidan (CONTOH)' },
]

export function LoginView({
  onAuthenticated,
  twoFaPendingEmail,
}: {
  onAuthenticated: () => Promise<void>
  twoFaPendingEmail?: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await loginAction(email, password)
      if (!res.ok) {
        setError(res.error ?? 'Gagal masuk.')
        return
      }
      if (res.next === '2fa') {
        // tetap di tampilan ini; induk akan menampilkan tahap 2FA
        await onAuthenticated()
        return
      }
      await onAuthenticated()
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify2fa(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setOtpError(null)
    try {
      const res = await verify2faAction(otp)
      if (!res.ok) {
        setOtpError(res.error ?? 'Kode tidak valid.')
        return
      }
      await onAuthenticated()
    } catch {
      setOtpError('Terjadi kesalahan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  if (twoFaPendingEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
        <div className="w-full max-w-md space-y-4">
          <BrandHeader />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Verifikasi dua langkah
              </CardTitle>
              <CardDescription>
                Masukkan kode 6 digit dari aplikasi autentikator untuk akun{' '}
                <span className="font-medium text-foreground">{twoFaPendingEmail}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify2fa} className="space-y-4">
                <div className="flex justify-center py-2">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={busy}>
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
                {otpError && (
                  <Alert variant="destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertDescription>{otpError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full min-h-11" disabled={busy || otp.length < 6}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Verifikasi
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground">
            Lingkungan contoh — seluruh data bersifat fiktif dan bertanda CONTOH.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Panel identitas produk */}
        <div className="hidden flex-col justify-between rounded-xl border bg-card p-8 lg:flex">
          <div>
            <BrandHeader />
            <div className="mt-8 space-y-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">e-SIMANTRI</span> adalah Rekam Medis
                Elektronik (RME) untuk tempat praktik mandiri tenaga medis dan tenaga kesehatan —
                bukan SIMRS rumah sakit.
              </p>
              <p>
                Dibangun mengikuti arah regulasi rekam medis nasional, termasuk PMK 24/2022 tentang
                Rekam Medis, dengan jejak audit, peran sesuai kewenangan profesi, dan persiapan
                interoperabilitas SATUSEHAT.
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-secondary/60 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Status: Fase 0 — Fondasi</p>
            <p className="mt-1">
              Yang tersedia: kerangka aplikasi multi-praktik, masuk akun, peran, jejak audit, dan
              profil tempat praktik. Modul klinis menyusul pada fase berikutnya.
            </p>
            <p className="mt-2 italic">
              Sistem belum tersertifikasi dan belum dinyatakan siap produksi; kepatuhan produksi
              memerlukan peninjauan hukum, uji keamanan, dan proses registrasi oleh manusia.
            </p>
          </div>
        </div>

        {/* Form masuk */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Masuk ke e-SIMANTRI</CardTitle>
              <CardDescription>Gunakan akun yang diberikan tempat praktik Anda.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="nama@praktik.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Kata sandi</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="min-h-11"
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full min-h-11" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Masuk
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="demo">
                  <AccordionTrigger className="text-sm">
                    Akun contoh untuk mencoba (data fiktif)
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Seluruh akun di bawah memakai kata sandi{' '}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono">Contoh123!</code>{' '}
                      Data sepenuhnya fiktif bertanda CONTOH — bukan data pasien sungguhan.
                    </p>
                    <ul className="space-y-1 text-xs">
                      {DEMO_ACCOUNTS.map((a) => (
                        <li
                          key={a.email}
                          className="flex flex-wrap items-center justify-between gap-1 rounded border px-2 py-1.5"
                        >
                          <span className="font-mono">{a.email}</span>
                          <span className="text-muted-foreground">
                            {a.role} — {a.org}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground lg:hidden">
            Lingkungan contoh — seluruh data bersifat fiktif dan bertanda CONTOH.
          </p>
        </div>
      </div>
    </div>
  )
}

function BrandHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Activity className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">e-SIMANTRI</h1>
        <p className="text-xs text-muted-foreground">
          Sistem Informasi Manajemen Praktik Mandiri Terintegrasi
        </p>
      </div>
    </div>
  )
}
