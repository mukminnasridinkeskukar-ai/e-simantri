import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { BadgeKunjungan } from '@/components/klinis/badge-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CalendarPlus, CalendarDays, Search } from 'lucide-react'
import { ENCOUNTER_STATUS, ENCOUNTER_STATUS_LABELS, ENCOUNTER_TYPE_LABELS, formatWaktuLengkap } from '@/lib/modules/konstanta'
import { cn } from '@/lib/utils'

export default async function HalamanKunjungan({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const ctx = await requirePermission('kunjungan.lihat')
  const sp = await searchParams
  const status = (ENCOUNTER_STATUS as readonly string[]).includes(sp.status ?? '') ? sp.status! : ''
  const q = (sp.q ?? '').trim().slice(0, 80)

  const daftar = await db.encounter.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(status ? { status } : { status: { not: 'BATAL' } }),
      ...(q
        ? {
            OR: [
              { encounterNumber: { contains: q } },
              { chiefComplaint: { contains: q } },
              { patient: { name: { contains: q } } },
              { patient: { medicalRecordNumber: { contains: q } } },
            ],
          }
        : {}),
    },
    orderBy: { registeredAt: 'desc' },
    take: 80,
    include: { patient: true },
  })

  const bisaDaftar = hasPermission(ctx.roles, 'kunjungan.daftar')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kunjungan</h1>
          <p className="text-sm text-muted-foreground">
            Alur: terdaftar → diperiksa → selesai → dikunci → terkirim/gagal kirim. Kunjungan tidak pernah dihapus.
          </p>
        </div>
        {bisaDaftar ? (
          <Button asChild className="min-h-[44px]">
            <Link href="/kunjungan/baru">
              <CalendarPlus className="mr-2 h-4 w-4" /> Kunjungan baru
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> Daftar kunjungan
            <Badge variant="secondary" className="ml-1">
              {daftar.length}
            </Badge>
          </CardTitle>
          <CardDescription>Filter status dan pencarian cepat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip href={`/kunjungan${q ? `?q=${encodeURIComponent(q)}` : ''}`} aktif={!status} label="Semua aktif" />
            {ENCOUNTER_STATUS.map((s) => (
              <FilterChip
                key={s}
                href={`/kunjungan?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                aktif={status === s}
                label={ENCOUNTER_STATUS_LABELS[s]}
              />
            ))}
          </div>

          <form className="flex gap-2" action="/kunjungan">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input name="q" defaultValue={q} placeholder="Cari nomor kunjungan, pasien, keluhan…" className="pl-9 min-h-[44px]" aria-label="Cari kunjungan" />
            </div>
            <Button type="submit" variant="secondary" className="min-h-[44px]">
              Cari
            </Button>
          </form>

          {/* Desktop: tabel */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunjungan</TableHead>
                  <TableHead>Pasien</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Keluhan utama</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu daftar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Tidak ada kunjungan sesuai filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  daftar.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>
                        <Link href={`/kunjungan/${k.id}`} className="font-medium text-primary underline underline-offset-2">
                          {k.encounterNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{k.patient.name}</p>
                        <p className="text-xs text-muted-foreground">{k.patient.medicalRecordNumber}</p>
                      </TableCell>
                      <TableCell className="text-sm">{ENCOUNTER_TYPE_LABELS[k.type as keyof typeof ENCOUNTER_TYPE_LABELS] ?? k.type}</TableCell>
                      <TableCell className="max-w-64 truncate text-sm" title={k.chiefComplaint ?? ''}>
                        {k.chiefComplaint ?? '—'}
                      </TableCell>
                      <TableCell>
                        <BadgeKunjungan status={k.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatWaktuLengkap(k.registeredAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: kartu */}
          <div className="grid gap-3 md:hidden">
            {daftar.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada kunjungan sesuai filter.</p>
            ) : (
              daftar.map((k) => (
                <Link key={k.id} href={`/kunjungan/${k.id}`} className="block rounded-lg border p-3 active:bg-muted/50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{k.encounterNumber}</span>
                    <BadgeKunjungan status={k.status} />
                  </div>
                  <p className="mt-1 text-sm font-medium">{k.patient.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ENCOUNTER_TYPE_LABELS[k.type as keyof typeof ENCOUNTER_TYPE_LABELS] ?? k.type} · {formatWaktuLengkap(k.registeredAt)}
                  </p>
                  <p className="mt-1 text-sm">{k.chiefComplaint}</p>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FilterChip({ href, aktif, label }: { href: string; aktif: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium min-h-[32px] inline-flex items-center',
        aktif ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
      )}
    >
      {label}
    </Link>
  )
}
