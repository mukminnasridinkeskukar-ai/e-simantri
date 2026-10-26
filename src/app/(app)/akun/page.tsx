import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireOrg, listMemberships } from '@/lib/modules/tenant/context'
import { pilihPraktikLangsung } from '@/lib/modules/identity_access/actions'
import { ROLE_LABELS, type Role } from '@/lib/modules/identity_access/roles'
import { DialogUbahSandi, TombolKeluarPerangkatLain } from '@/components/app-shell/dialog-akun'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Info, Building2, MonitorSmartphone, Clock, ShieldCheck } from 'lucide-react'

function formatWaktu(d: Date): string {
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function HalamanAkun() {
  const ctx = await requireOrg()
  const memberships = await listMemberships(ctx.auth.userId)

  const jumlahSesi = await db.session.count({
    where: { userId: ctx.auth.userId, expiresAt: { gt: new Date() } },
  })

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Akun saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Data diri, keanggotaan lintas praktik, dan pengelolaan sesi.
        </p>
      </div>

      {/* Profil diri */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-lg font-semibold">{ctx.auth.fullName}</p>
            <p className="text-sm text-muted-foreground">{ctx.auth.email}</p>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Surel</span>
                <span className="font-medium text-right break-all">{ctx.auth.email}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Nama lengkap</span>
                <span className="font-medium text-right">{ctx.auth.fullName}</span>
              </div>
            </div>
            <div className="space-y-2.5 text-sm mt-2.5 sm:mt-0">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Akun dibuat</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <Badge>Aktif</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keanggotaan lintas praktik */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" aria-hidden="true" /> Keanggotaan praktik
          </CardTitle>
          <CardDescription>
            Satu akun boleh tergabung di lebih dari satu tempat praktik, dengan peran yang
            bisa berbeda di tiap praktik. Data antarpraktik tetap terisolasi ketat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships.map((m) => {
            const aktif = m.organizationId === ctx.organizationId
            return (
              <div
                key={m.membershipId}
                className={
                  'rounded-lg border p-3.5 flex flex-wrap items-center justify-between gap-3 ' +
                  (aktif ? 'border-primary/50 bg-accent/30' : '')
                }
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm">{m.organizationName}</p>
                    {aktif ? <Badge>Praktik aktif</Badge> : null}
                    {m.isSample ? <Badge variant="secondary">DATA CONTOH</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Peran di sini: {m.roles.map((r) => ROLE_LABELS[r as Role]).join(', ')}
                  </p>
                </div>
                {!aktif ? (
                  <form action={pilihPraktikLangsung}>
                    <input type="hidden" name="organizationId" value={m.organizationId} />
                    <Button variant="outline" size="sm" type="submit" className="min-h-[44px]">
                      Pindah ke praktik ini
                    </Button>
                  </form>
                ) : null}
              </div>
            )
          })}
          {memberships.length === 1 ? (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              Anda saat ini hanya tergabung pada satu tempat praktik.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Sesi & keamanan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4" aria-hidden="true" /> Sesi & keamanan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Masuk pada
              </span>
              <span className="font-medium">{formatWaktu(ctx.auth.loginAt)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Sesi berakhir pada
              </span>
              <span className="font-medium">{formatWaktu(ctx.auth.expiresAt)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Sesi aktif</span>
              <span className="font-medium">{jumlahSesi}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Verifikasi dua langkah</span>
              <Badge variant="outline">Direncanakan</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            Peran klinis dan penanggung jawab akan wajib dapat memakai verifikasi dua langkah;
            fitur ini diaktifkan pada fase berikutnya dan belum tersedia pada Fase 0.
          </p>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <DialogUbahSandi />
            <TombolKeluarPerangkatLain />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
