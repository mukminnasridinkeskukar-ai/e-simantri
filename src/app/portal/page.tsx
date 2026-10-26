// ============================================================
// MODUL: patient_portal — halaman publik portal pasien (Fase 6)
// Akses terpisah dari akun staf: kode 6 digit + tanggal lahir.
// Hanya kunjungan TERKUNCI yang ditampilkan (ringkas, baca-saja).
// ============================================================

import { db } from '@/lib/db'
import { sesiPortal, keluarPortal, catatAksesPortal } from '@/lib/modules/patient_portal/portal-actions'
import { FormMasukPortal } from './form-masuk'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BadgeKunjungan } from '@/components/klinis/badge-status'
import { HeartPulse, LogOut, Info } from 'lucide-react'
import { formatTanggal, formatWaktuLengkap, hitungUmur, CONSENT_TYPE_LABELS } from '@/lib/modules/konstanta'

export const metadata = { title: 'Portal Pasien — e-SIMANTRI' }

export default async function HalamanPortal() {
  const sesi = await sesiPortal()

  const pasien = sesi
    ? await db.patient.findFirst({
        where: { id: sesi.patientId },
        include: {
          encounters: {
            where: { status: { in: ['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'] } },
            orderBy: { registeredAt: 'desc' },
            include: {
              diagnoses: true,
              procedures: true,
              prescriptions: { where: { status: { not: 'DIBATALKAN' } }, include: { items: true } },
            },
          },
          consents: { orderBy: { createdAt: 'desc' } },
          organization: true,
        },
      })
    : null

  if (sesi && pasien) {
    await catatAksesPortal(pasien.id)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <HeartPulse className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="font-semibold">Portal Pasien e-SIMANTRI</span>
          {sesi && pasien ? (
            <form action={keluarPortal} className="ml-auto">
              <Button type="submit" variant="outline" size="sm" className="min-h-[44px]">
                <LogOut className="mr-1.5 h-4 w-4" /> Keluar
              </Button>
            </form>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 space-y-4">
        {!sesi || !pasien ? (
          <div className="mx-auto max-w-md space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Masuk ke riwayat kesehatan Anda</CardTitle>
                <CardDescription>
                  Gunakan kode akses 6 angka dari tempat praktik dan tanggal lahir Anda. Data yang tampil hanya ringkasan
                  kunjungan yang sudah dikunci.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormMasukPortal />
                <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <Info className="h-3.5 w-3.5" aria-hidden="true" /> Lingkungan contoh
                  </p>
                  <p className="mt-1">
                    Demo memakai pasien contoh: kode <code className="rounded bg-muted px-1">482913</code>, tanggal lahir{' '}
                    <code className="rounded bg-muted px-1">10/01/1988</code>. Pada lingkungan nyata, kode hanya diberikan ke
                    pasien oleh petugas praktik.
                  </p>
                </div>
              </CardContent>
            </Card>
            <p className="text-center text-xs text-muted-foreground">
              Staf praktik? <a href="/" className="text-primary underline underline-offset-2">Masuk ke aplikasi staf</a>.
            </p>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{pasien.name}</CardTitle>
                <CardDescription>
                  {pasien.organization.name} · {pasien.medicalRecordNumber}
                  {pasien.nik ? ` · NIK tersimpan` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p>
                  Tanggal lahir {formatTanggal(pasien.dateOfBirth)} ({hitungUmur(pasien.dateOfBirth)})
                </p>
                <p>Riwayat alergi: {pasien.allergiesNote ?? 'belum dicatat'}</p>
              </CardContent>
            </Card>

            <h2 className="text-base font-semibold">Kunjungan terkunci ({pasien.encounters.length})</h2>
            {pasien.encounters.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada kunjungan yang selesai dikunci.</p>
            ) : (
              pasien.encounters.map((k) => (
                <Card key={k.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {formatWaktuLengkap(k.registeredAt)} <BadgeKunjungan status={k.status} />
                    </CardTitle>
                    <CardDescription>Keluhan: {k.chiefComplaint ?? '—'}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm">
                    {k.diagnoses.length > 0 ? (
                      <p>
                        <span className="text-muted-foreground">Diagnosa: </span>
                        {k.diagnoses.map((d) => d.display).join('; ')}
                      </p>
                    ) : null}
                    {k.procedures.length > 0 ? (
                      <p>
                        <span className="text-muted-foreground">Tindakan: </span>
                        {k.procedures.map((t) => t.name).join('; ')}
                      </p>
                    ) : null}
                    {k.prescriptions.length > 0 ? (
                      <div>
                        <span className="text-muted-foreground">Obat: </span>
                        <ul className="mt-1 list-disc pl-5">
                          {k.prescriptions.flatMap((r) => r.items).map((it) => (
                            <li key={it.id}>
                              {it.drugName} {it.strength ?? ''} — {it.usage}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}

            <h2 className="text-base font-semibold">Persetujuan ({pasien.consents.length})</h2>
            {pasien.consents.map((c) => (
              <Card key={c.id}>
                <CardContent className="py-3 text-sm">
                  <p className="font-medium">
                    {CONSENT_TYPE_LABELS[c.type] ?? c.type} <Badge variant="secondary" className="ml-1">{formatWaktuLengkap(c.createdAt)}</Badge>
                  </p>
                  <p className="mt-1 text-muted-foreground">{c.agreedText}</p>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </main>

      <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
        Lingkungan contoh · data fiktif bertanda CONTOH · tidak ada klaim sertifikasi
      </footer>
    </div>
  )
}
