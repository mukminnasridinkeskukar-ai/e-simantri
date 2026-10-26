import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOrg } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BadgeKunjungan } from '@/components/klinis/badge-status'
import {
  CalendarPlus,
  PersonStanding,
  Pill,
  Receipt,
  PlugZap,
  Gauge,
  KeyRound,
  ScrollText,
} from 'lucide-react'
import { formatWaktuLengkap } from '@/lib/modules/konstanta'

export default async function HalamanBeranda() {
  const ctx = await requireOrg()

  const hariIni = new Date()
  hariIni.setHours(0, 0, 0, 0)

  const [
    kunjunganHariIni,
    antrean,
    resepAktif,
    tagihanTerbit,
    jumlahPasien,
    antreanSatusehat,
    auditTerakhir,
  ] = await Promise.all([
    db.encounter.count({ where: { organizationId: ctx.organizationId, registeredAt: { gte: hariIni } } }),
    db.encounter.count({ where: { organizationId: ctx.organizationId, status: 'TERDAFTAR' } }),
    db.prescription.count({ where: { organizationId: ctx.organizationId, status: 'DIBUAT' } }),
    db.invoice.count({ where: { organizationId: ctx.organizationId, status: 'TERBIT' } }),
    db.patient.count({ where: { organizationId: ctx.organizationId, status: 'AKTIF' } }),
    db.outboxEvent.count({ where: { organizationId: ctx.organizationId, status: { in: ['ANTRE', 'GAGAL_KIRIM'] } } }),
    db.auditLog.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ])

  const kunjunganTerbaru = await db.encounter.findMany({
    where: { organizationId: ctx.organizationId, status: { not: 'BATAL' } },
    orderBy: { registeredAt: 'desc' },
    take: 5,
    include: { patient: true },
  })

  const bisa = (izin: Parameters<typeof hasPermission>[1]) => hasPermission(ctx.roles, izin)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Selamat bertugas,</p>
        <h1 className="text-xl font-semibold tracking-tight">{ctx.auth.fullName}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{ctx.organizationName}</p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Statistik ikon={<CalendarPlus className="h-4 w-4" />} label="Kunjungan hari ini" nilai={kunjunganHariIni} sub={`${antrean} menunggu pemeriksaan`} />
        <Statistik ikon={<PersonStanding className="h-4 w-4" />} label="Pasien aktif" nilai={jumlahPasien} sub="satu pasien satu berkas" />
        <Statistik ikon={<Pill className="h-4 w-4" />} label="Resep menunggu" nilai={resepAktif} sub="di antrean farmasi" />
        <Statistik ikon={<Receipt className="h-4 w-4" />} label="Tagihan terbit" nilai={tagihanTerbit} sub="menunggu pembayaran" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Kunjungan terbaru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {kunjunganTerbaru.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada kunjungan.</p>
            ) : (
              kunjunganTerbaru.map((k) => (
                <Link key={k.id} href={`/kunjungan/${k.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/40">
                  <span className="font-medium">{k.encounterNumber}</span>
                  <span>{k.patient.name}</span>
                  <BadgeKunjungan status={k.status} className="ml-auto" />
                </Link>
              ))
            )}
            {bisa('kunjungan.lihat') ? (
              <Button asChild variant="ghost" size="sm" className="min-h-[44px]">
                <Link href="/kunjungan">Lihat semua kunjungan</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" /> Aktivitas terakhir (jejak audit)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {auditTerakhir.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada peristiwa.</p>
            ) : (
              auditTerakhir.map((a) => (
                <p key={a.id} className="text-xs leading-relaxed">
                  <span className="text-muted-foreground">{formatWaktuLengkap(a.createdAt)}</span> — {a.summary}
                </p>
              ))
            )}
            {bisa('audit.lihat') ? (
              <Button asChild variant="ghost" size="sm" className="min-h-[44px]">
                <Link href="/audit">Buka jejak audit</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Modul pada praktik Anda (Fase 0–8)</CardTitle>
          <CardDescription>
            Semua modul aktif pada lingkungan contoh. Akses setiap modul mengikuti peran Anda dan seluruhnya teraudit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {bisa('pasien.lihat') ? (
            <Link href="/pasien" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <PersonStanding className="mr-1.5 inline h-4 w-4" /> Pasien
            </Link>
          ) : null}
          {bisa('kunjungan.lihat') ? (
            <Link href="/kunjungan" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <CalendarPlus className="mr-1.5 inline h-4 w-4" /> Kunjungan
            </Link>
          ) : null}
          {bisa('resep.serahkan') ? (
            <Link href="/farmasi" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <Pill className="mr-1.5 inline h-4 w-4" /> Farmasi
            </Link>
          ) : null}
          {bisa('klaim.lihat') ? (
            <Link href="/klaim" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <Receipt className="mr-1.5 inline h-4 w-4" /> Tagihan & Klaim
            </Link>
          ) : null}
          {bisa('satusehat.lihat') ? (
            <Link href="/satusehat" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <PlugZap className="mr-1.5 inline h-4 w-4" /> SATUSEHAT{' '}
              {antreanSatusehat > 0 ? <Badge variant="secondary" className="ml-1">{antreanSatusehat}</Badge> : null}
            </Link>
          ) : null}
          {bisa('mutu.lihat') ? (
            <Link href="/mutu" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <Gauge className="mr-1.5 inline h-4 w-4" /> Mutu & Retensi
            </Link>
          ) : null}
          {bisa('portal.kelola') ? (
            <Link href="/pasien" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
              <KeyRound className="mr-1.5 inline h-4 w-4" /> Kode portal pasien
            </Link>
          ) : null}
          <Link href="/peta-modul" className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
            Peta modul & tata kelola
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function Statistik({ ikon, label, nilai, sub }: { ikon: React.ReactNode; label: string; nilai: number; sub: string }) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {ikon}
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold">{nilai}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}
