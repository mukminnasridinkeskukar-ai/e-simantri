import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { FormKonfigSatusehat, TombolProsesAntrean } from '@/components/klinis/form-satusehat'
import { BadgeOutbox } from '@/components/klinis/badge-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlugZap, RefreshCcw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { OUTBOX_EVENT_LABELS, formatWaktuLengkap } from '@/lib/modules/konstanta'
import { cobaUlangKejadian } from '@/lib/modules/integration_satusehat/config-actions'
import Link from 'next/link'

export default async function HalamanSatusehat() {
  const ctx = await requirePermission('satusehat.lihat')
  const bisaKelola = hasPermission(ctx.roles, 'satusehat.kelola')

  const [config, antrean, log] = await Promise.all([
    db.satusehatConfig.findUnique({ where: { organizationId: ctx.organizationId } }),
    db.outboxEvent.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { encounter: { include: { patient: true } } },
    }),
    db.fhirSyncLog.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const statistik = {
    ANTRE: antrean.filter((e) => e.status === 'ANTRE').length,
    TERKIRIM: antrean.filter((e) => e.status === 'TERKIRIM').length,
    GAGAL_KIRIM: antrean.filter((e) => e.status === 'GAGAL_KIRIM').length,
    GAGAL_VALIDASI: antrean.filter((e) => e.status === 'GAGAL_VALIDASI').length,
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <PlugZap className="h-5 w-5" /> Integrasi SATUSEHAT (Fase 5)
        </h1>
        <p className="text-sm text-muted-foreground">
          Pola outbox: RME tidak memanggil API dari alur klinis. Kunjungan terkunci → antrean → pekerja mengirim per sumber daya FHIR.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <p className="flex items-center gap-1.5 font-medium">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" /> Lingkungan contoh — bukan koneksi produksi
        </p>
        <p className="mt-1">
          Mode SIMULASI tidak menghubungi server mana pun; ID sumber daya berawalan CONTOH. Mode SANDBOX mengirim ke URL
          sandbox yang Anda isi. Tidak ada klaim sertifikasi atau koneksi SATUSEHAT produksi dari aplikasi ini.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(['ANTRE', 'TERKIRIM', 'GAGAL_KIRIM', 'GAGAL_VALIDASI'] as const).map((s) => (
          <Card key={s}>
            <CardContent className="flex items-center gap-2 py-3">
              <BadgeOutbox status={s} />
              <span className="text-lg font-semibold">{statistik[s]}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {bisaKelola ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Konfigurasi praktik</CardTitle>
            <CardDescription>
              Kredensial disimpan pada basis data praktik ini. Untuk produksi gunakan secret manager (lihat panduan deploy).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormKonfigSatusehat
              config={{
                mode: config?.mode ?? 'SIMULASI',
                enabled: config?.enabled ?? false,
                baseUrl: config?.baseUrl ?? null,
                clientId: config?.clientId ?? null,
                locationRefId: config?.locationRefId ?? null,
                adaSecret: Boolean(config?.clientSecret),
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {bisaKelola ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCcw className="h-4 w-4" /> Pekerja antrean
            </CardTitle>
            <CardDescription>
              {config?.enabled
                ? `Integrasi AKTIF — mode ${config.mode}. Pemrosesan terakhir ${formatWaktuLengkap(config.lastProcessedAt)}.`
                : 'Integrasi nonaktif — antrean baru tidak dibuat. Aktifkan pada konfigurasi.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TombolProsesAntrean />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Antrean kejadian (40 terakhir)</CardTitle>
          <CardDescription>Setiap kunjungan terkunci menghasilkan: Patient, Encounter, Condition, Observation, Procedure, MedicationRequest, Composition.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {antrean.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kejadian. Kunci satu kunjungan dengan integrasi aktif.</p>
          ) : (
            antrean.map((ev) => (
              <div key={ev.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{OUTBOX_EVENT_LABELS[ev.eventType] ?? ev.eventType}</span>
                  <BadgeOutbox status={ev.status} />
                  <Link href={`/kunjungan/${ev.encounterId}?tab=kirim`} className="text-xs text-primary underline underline-offset-2">
                    {ev.encounter.encounterNumber} · {ev.encounter.patient.name}
                  </Link>
                  <span className="ml-auto text-xs text-muted-foreground">
                    percobaan {ev.attempts}
                    {ev.sentAt ? ` · ${formatWaktuLengkap(ev.sentAt)}` : ''}
                  </span>
                </div>
                {ev.fhirResourceId ? <p className="mt-1 text-xs text-muted-foreground">ID sumber daya: {ev.fhirResourceId}</p> : null}
                {ev.lastError ? <p className="mt-1 text-xs text-red-700">{ev.lastError}</p> : null}
                {bisaKelola && ev.status === 'GAGAL_KIRIM' ? (
                  <form action={cobaUlangKejadian} className="mt-2">
                    <input type="hidden" name="eventId" value={ev.id} />
                    <Button type="submit" variant="outline" size="sm" className="min-h-[44px]">
                      Coba ulang
                    </Button>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Riwayat percobaan kirim (10 terakhir)
          </CardTitle>
          <CardDescription>Setiap percobaan tercatat; kegagalan tidak pernah menghapus data lokal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada percobaan.</p>
          ) : (
            log.map((l) => (
              <p key={l.id} className="text-sm">
                <Badge variant="outline" className="mr-2 bg-muted/60">
                  {l.outcome}
                </Badge>
                {formatWaktuLengkap(l.createdAt)} — {l.message ?? '(tanpa pesan)'}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
