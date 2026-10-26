import { db } from '@/lib/db'
import { requireOrg } from '@/lib/modules/tenant/context'
import { MODULE_REGISTRY, PHASE_PLAN } from '@/lib/modules'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Layers, ScrollText, CircleCheck, CircleDashed, Gavel, Rocket } from 'lucide-react'

export default async function HalamanPetaModul() {
  const ctx = await requireOrg()

  const [regulasi, rilis] = await Promise.all([
    db.regulationRef.findMany({ orderBy: { code: 'asc' } }),
    db.releaseLog.findMany({ orderBy: { releasedAt: 'desc' } }),
  ])

  function daftar(json: string | null): string[] {
    if (!json) return []
    try {
      const v = JSON.parse(json)
      return Array.isArray(v) ? v.map(String) : []
    } catch {
      return []
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Peta modul & tata kelola</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Batas modul yang tegas: setiap modul punya skema data dan antarmuka sendiri. Modul
          baru ditambah tanpa membongkar inti RME.
        </p>
      </div>

      {/* Peta modul */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" aria-hidden="true" /> Modul sistem
          </CardTitle>
          <CardDescription>
            Status per {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} — Fase 0–8 diluncurkan pada lingkungan contoh.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULE_REGISTRY.map((m) => (
            <div key={m.id} className="rounded-lg border p-3.5 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold">{m.name}</p>
                {m.status === 'AKTIF' ? (
                  <Badge className="gap-1">
                    <CircleCheck className="h-3 w-3" /> Aktif (Fase {m.phase})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <CircleDashed className="h-3 w-3" /> Fase {m.phase}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{m.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Peta fase */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" aria-hidden="true" /> Rencana fase
          </CardTitle>
          <CardDescription>
            Satu fase setiap giliran; setiap fase menunjukkan yang bisa dipakai dan yang
            sengaja ditunda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PHASE_PLAN.map((f) => (
            <div
              key={f.phase}
              className={
                'rounded-lg border p-3.5 ' + (f.phase === 0 ? 'border-primary/40 bg-accent/40' : '')
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={f.phase === 0 ? 'default' : 'secondary'}>Fase {f.phase}</Badge>
                <p className="font-medium text-sm">{f.title}</p>
                {f.phase === 0 ? <Badge variant="secondary">Sedang berjalan</Badge> : null}
              </div>
              <ul className="mt-2 space-y-1">
                {f.scope.map((s) => (
                  <li key={s} className="text-sm text-muted-foreground flex gap-2">
                    <span aria-hidden="true">–</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Changelog rilis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" aria-hidden="true" /> Changelog rilis
          </CardTitle>
          <CardDescription>
            Setiap rilis mencatat: fitur, dampak regulasi, migrasi data, dan yang sengaja
            belum dilakukan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {rilis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada catatan rilis.</p>
          ) : (
            rilis.map((r) => (
              <div key={r.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{r.version}</Badge>
                  <p className="font-medium text-sm">{r.phase}</p>
                  <span className="text-xs text-muted-foreground">
                    {r.releasedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Fitur</p>
                  <ul className="space-y-1">
                    {daftar(r.features).map((f) => (
                      <li key={f} className="text-sm flex gap-2">
                        <CircleCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                {r.regulatoryImpact ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Dampak regulasi</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.regulatoryImpact}</p>
                  </div>
                ) : null}
                {r.migrationNote ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Migrasi data</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.migrationNote}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Sengaja belum dilakukan</p>
                  <ul className="space-y-1">
                    {daftar(r.deferred).map((f) => (
                      <li key={f} className="text-sm flex gap-2">
                        <CircleDashed className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Regulasi acuan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gavel className="h-4 w-4" aria-hidden="true" /> Regulasi yang dilacak
          </CardTitle>
          <CardDescription>
            Produk membantu fasilitas patuh; sistem tidak membuat klaim kepatuhan. Naskah
            resmi dirujuk dari JDIH Kementerian Kesehatan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {regulasi.map((g) => (
              <li key={g.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{g.title}</p>
                  <Badge variant={g.status === 'BERLAKU' ? 'secondary' : 'outline'}>{g.status}</Badge>
                </div>
                {g.note ? (
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{g.note}</p>
                ) : null}
                {g !== regulasi[regulasi.length - 1] ? <Separator className="mt-4" /> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Alert>
        <ScrollText className="h-4 w-4" />
        <AlertDescription className="leading-relaxed">
          Ketika peraturan berubah, modul ditambah lewat lapisan adapter dan changelog
          regulasi — logika klinis tidak dikunci ke satu versi pedoman. Terminologi dan mapper
          FHIR dibuat berversi: perubahan pedoman Kemenkes menghasilkan versi mapper baru,
          bukan sunyian diam-diam pada data lama.
        </AlertDescription>
      </Alert>
    </div>
  )
}
