import { redirect } from 'next/navigation'
import { getAuthState } from '@/lib/modules/identity_access/session'
import { listMemberships } from '@/lib/modules/tenant/context'
import { keluar } from '@/lib/modules/identity_access/actions'
import { KartuPraktik } from '@/components/app-shell/kartu-praktik'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HeartPulse, Info, LogOut } from 'lucide-react'

export default async function HalamanPilihPraktik() {
  const auth = await getAuthState()
  if (!auth) redirect('/masuk')

  const memberships = await listMemberships(auth.userId)

  return (
    <main className="min-h-screen flex flex-col bg-sidebar/50">
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <HeartPulse className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold">Pilih tempat praktik</p>
              <p className="text-sm text-muted-foreground">
                Masuk sebagai {auth.fullName} ({auth.email})
              </p>
            </div>
          </div>

          {memberships.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="leading-relaxed">
                Anda belum tergabung aktif di tempat praktik mana pun.
                Hubungi penanggung jawab praktik untuk didaftarkan sebagai pengguna.
                <span className="block mt-3">
                  <form action={keluar}>
                    <Button variant="outline" size="sm" type="submit">
                      <LogOut className="mr-2 h-4 w-4" /> Keluar dari akun ini
                    </Button>
                  </form>
                </span>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {memberships.map((m) => (
                <div key={m.membershipId} className="relative">
                  {m.isSample ? (
                    <Badge variant="secondary" className="absolute -top-2 right-3 z-10">
                      DATA CONTOH
                    </Badge>
                  ) : null}
                  <KartuPraktik org={m} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground">
            <span>e-SIMANTRI Fase 0 — Fondasi</span>
            {memberships.length > 0 ? (
              <form action={keluar}>
                <Button variant="ghost" size="sm" type="submit" className="h-9">
                  <LogOut className="mr-1.5 h-4 w-4" /> Keluar
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}
