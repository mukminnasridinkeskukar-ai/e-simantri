import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { templateUntukProfesi, cekKelengkapan, type IsiDokumen } from '@/lib/modules/clinical_document/templates'
import { BadgeKunjungan } from '@/components/klinis/badge-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Gauge, Archive, ScrollText } from 'lucide-react'
import { formatWaktuLengkap } from '@/lib/modules/konstanta'
import { db as prismaDb } from '@/lib/db'

export default async function HalamanMutu() {
  const ctx = await requirePermission('mutu.lihat')

  const kunjunganTerkunci = await db.encounter.findMany({
    where: { organizationId: ctx.organizationId, status: { in: ['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'] } },
    orderBy: { lockedAt: 'desc' },
    take: 50,
    include: {
      patient: true,
      documents: { where: { isCurrent: true } },
      diagnoses: true,
      prescriptions: { where: { status: { not: 'DIBATALKAN' } } },
    },
  })

  const [jumlahPasien, jumlahDokumen, regulasi] = await Promise.all([
    prismaDb.patient.count({ where: { organizationId: ctx.organizationId } }),
    prismaDb.clinicalDocument.count({ where: { organizationId: ctx.organizationId } }),
    prismaDb.regulationRef.findMany({ orderBy: { code: 'asc' } }),
  ])

  const penilaian = kunjunganTerkunci.map((k) => {
    const doc = k.documents.find((d) => d.type === 'CATATAN_PEMERIKSAAN' && d.isCurrent)
    const isi = doc ? (JSON.parse(doc.content) as IsiDokumen) : null
    const odontogram = k.documents.some((d) => d.type === 'ODONTOGRAM' && d.isCurrent)
    const template = templateUntukProfesi(doc?.profession ?? 'Dokter')
    const kurang = cekKelengkapan(template, isi, {
      adaDiagnosa: k.diagnoses.length > 0,
      adaOdontogram: odontogram,
      adaTerapi: k.prescriptions.length > 0,
    })
    return { kunjungan: k, kurang, template }
  })

  const lengkap = penilaian.filter((p) => p.kurang.length === 0).length
  const persen = penilaian.length > 0 ? Math.round((lengkap / penilaian.length) * 100) : 100
  const kurangDaftar = penilaian.filter((p) => p.kurang.length > 0)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Gauge className="h-5 w-5" /> Mutu & Retensi (Fase 7)
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelengkapan field wajib rekam medis rawat jalan dan kebijakan retensi pada praktik aktif.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Kunjungan terkunci (50 terakhir)</p>
            <p className="text-lg font-semibold">{penilaian.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Lengkap semua field wajib</p>
            <p className="text-lg font-semibold">{lengkap}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Tingkat kelengkapan</p>
            <p className="text-lg font-semibold">{persen}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">Pasien · dokumen</p>
            <p className="text-lg font-semibold">
              {jumlahPasien} · {jumlahDokumen}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kunjungan dengan kelengkapan kurang</CardTitle>
          <CardDescription>
            Koreksi dilakukan lewat pembukaan kunci oleh Penanggung Jawab, lalu simpan sebagai versi baru — isi tidak pernah dihapus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {kurangDaftar.length === 0 ? (
            <p className="text-sm text-emerald-700">Semua kunjungan terkunci memenuhi daftar minimum. 👍</p>
          ) : (
            kurangDaftar.map(({ kunjungan, kurang }) => (
              <div key={kunjungan.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/kunjungan/${kunjungan.id}`} className="font-medium text-primary underline underline-offset-2">
                    {kunjungan.encounterNumber}
                  </Link>
                  <span>{kunjungan.patient.name}</span>
                  <BadgeKunjungan status={kunjungan.status} />
                  <span className="ml-auto text-xs text-muted-foreground">{formatWaktuLengkap(kunjungan.lockedAt)}</span>
                </div>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {kurang.slice(0, 6).map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                  {kurang.length > 6 ? <li>… dan {kurang.length - 6} lainnya</li> : null}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4" /> Kebijakan retensi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Isi rekam medis <strong>tidak memiliki jalur penghapusan</strong> pada aplikasi ini. Pasien yang dinonaktifkan,
            kunjungan yang dibatalkan, resep/tagihan yang dibatalkan tetap tersimpan lengkap dengan alasan dan jejak auditnya.
          </p>
          <p>
            Rentang simpan rekam medis mengikuti peraturan yang berlaku (mencakup ketentuan retensi hingga <strong>25 tahun</strong>).
            Penutupan praktik tidak menghapus isi rekam medis — tanggung jawab penyimpanan beralih sesuai peraturan.
          </p>
          <p className="text-muted-foreground">
            Cadangan basis data dan dokumentasi RPO/RTO adalah tanggung jawab penyelenggara saat berjalan di lingkungan produksi
            (lihat panduan deploy).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" /> Regulasi yang dilacak
          </CardTitle>
          <CardDescription>Hanya sumber acuan — tanpa klaim kepatuhan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {regulasi.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {r.title} <Badge variant="secondary" className="ml-1">{r.status}</Badge>
              </p>
              <p className="mt-1 text-muted-foreground">{r.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
