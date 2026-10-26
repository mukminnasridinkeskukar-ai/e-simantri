import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { FormKunjunganBaru } from '@/components/klinis/form-kunjungan'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CalendarPlus } from 'lucide-react'

export default async function HalamanKunjunganBaru({
  searchParams,
}: {
  searchParams: Promise<{ pasien?: string }>
}) {
  const ctx = await requirePermission('kunjungan.daftar')
  const sp = await searchParams

  const [daftarPasien, lokasi] = await Promise.all([
    db.patient.findMany({
      where: { organizationId: ctx.organizationId, status: 'AKTIF' },
      orderBy: { name: 'asc' },
      take: 300,
      select: { id: true, name: true, medicalRecordNumber: true },
    }),
    db.location.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { isPrimary: 'desc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2 min-h-[44px]">
          <Link href="/kunjungan">
            <ArrowLeft className="mr-1 h-4 w-4" /> Daftar kunjungan
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <CalendarPlus className="h-5 w-5" /> Kunjungan baru
        </h1>
        <p className="text-sm text-muted-foreground">
          Pendaftaran kunjungan untuk praktik aktif: {ctx.organizationName}.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data kunjungan</CardTitle>
          <CardDescription>
            Keluhan utama menjadi bagian rekam medis dan tidak dapat dihapus setelah tersimpan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormKunjunganBaru pasien={daftarPasien} lokasi={lokasi} />
        </CardContent>
      </Card>
    </div>
  )
}
