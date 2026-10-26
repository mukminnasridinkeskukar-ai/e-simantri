import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import { DialogPasien } from '@/components/klinis/dialog-pasien'
import { TombolPortalPasien } from '@/components/klinis/tombol-portal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BadgeKunjungan } from '@/components/klinis/badge-status'
import { CONSENT_TYPE_LABELS, formatRupiah, formatTanggal, formatWaktuLengkap, hitungUmur, ENCOUNTER_TYPE_LABELS } from '@/lib/modules/konstanta'
import { ArrowLeft, CalendarPlus, FileSignature, History, KeyRound, ShieldAlert, Info } from 'lucide-react'
import { format } from 'date-fns'

export default async function DetailPasien({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission('pasien.lihat')
  const { id } = await params

  const pasien = await db.patient.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      encounters: {
        orderBy: { registeredAt: 'desc' },
        include: {
          diagnoses: true,
          _count: { select: { procedures: true, prescriptions: true, consents: true } },
        },
      },
      consents: { orderBy: { createdAt: 'desc' } },
      portalAccess: { where: { isActive: true } },
    },
  })
  if (!pasien) notFound()

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'LIHAT_PASIEN',
    objectType: 'Patient',
    objectId: pasien.id,
    summary: `Membuka berkas pasien ${pasien.name} (${pasien.medicalRecordNumber})`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  const bisaKelola = hasPermission(ctx.roles, 'pasien.kelola')
  const bisaKunjungan = hasPermission(ctx.roles, 'kunjungan.daftar')
  const bisaPortal = hasPermission(ctx.roles, 'portal.kelola')

  const nilaiUntukForm = {
    id: pasien.id,
    name: pasien.name,
    nik: pasien.nik,
    dateOfBirth: pasien.dateOfBirth ? format(pasien.dateOfBirth, 'yyyy-MM-dd') : '',
    sex: pasien.sex ?? '',
    phone: pasien.phone,
    address: pasien.address,
    bloodType: pasien.bloodType,
    allergiesNote: pasien.allergiesNote,
    payerType: pasien.payerType,
    payerName: pasien.payerName,
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2 min-h-[44px]">
            <Link href="/pasien">
              <ArrowLeft className="mr-1 h-4 w-4" /> Daftar pasien
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{pasien.name}</h1>
          <p className="text-sm text-muted-foreground">
            {pasien.medicalRecordNumber}
            {pasien.nik ? ` · NIK ${pasien.nik}` : ' · tanpa NIK'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bisaKunjungan ? (
            <Button asChild className="min-h-[44px]">
              <Link href={`/kunjungan/baru?pasien=${pasien.id}`}>
                <CalendarPlus className="mr-2 h-4 w-4" /> Kunjungan baru
              </Link>
            </Button>
          ) : null}
          {bisaKelola ? <DialogPasien mode="ubah" nilai={nilaiUntukForm} /> : null}
        </div>
      </div>

      {pasien.status === 'NONAKTIF' ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Pasien <strong>nonaktif</strong>{pasien.statusNote ? `: ${pasien.statusNote}` : ''}. Riwayat kunjungan tetap tersimpan sesuai kewajiban retensi.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identitas & perawatan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Baris label="Tanggal lahir" nilai={`${formatTanggal(pasien.dateOfBirth)} (${hitungUmur(pasien.dateOfBirth)})`} />
            <Baris label="Jenis kelamin" nilai={pasien.sex === 'LAKI_LAKI' ? 'Laki-laki' : pasien.sex === 'PEREMPUAN' ? 'Perempuan' : '—'} />
            <Baris label="Telepon" nilai={pasien.phone ?? '—'} />
            <Baris label="Golongan darah" nilai={pasien.bloodType ?? '—'} />
            <Baris label="Alamat" nilai={pasien.address ?? '—'} />
            <Baris label="Penanggung pembayaran" nilai={pasien.payerType ?? '—'} />
            <Baris label="IHS SATUSEHAT" nilai={pasien.ihsNumber ?? 'belum ada'} />
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Riwayat alergi
              </p>
              <p className="mt-0.5">{pasien.allergiesNote ?? 'Belum dicatat — wajib diisi eksplisit saat pemeriksaan.'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Portal pasien (Fase 6)
            </CardTitle>
            <CardDescription>
              Pasien melihat riwayat ringkas miliknya lewat kode akses 6 digit + tanggal lahir. Kode disimpan sebagai hash.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {pasien.portalAccess.length > 0 ? (
              <p className="flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Kode aktif tersedia (terakhir dipakai {pasien.portalAccess[0].lastUsedAt ? formatWaktuLengkap(pasien.portalAccess[0].lastUsedAt) : 'belum pernah'}).
              </p>
            ) : (
              <p className="text-muted-foreground">Belum ada kode aktif.</p>
            )}
            {bisaPortal ? (
              <TombolPortalPasien patientId={pasien.id} namaPasien={pasien.name} adaTanggalLahir={Boolean(pasien.dateOfBirth)} />
            ) : null}
            <p className="text-xs text-muted-foreground">
              Tautan portal: <code className="rounded bg-muted px-1">/portal</code> (akses terpisah dari akun staf).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Riwayat kunjungan ({pasien.encounters.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pasien.encounters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kunjungan.</p>
          ) : (
            pasien.encounters.map((k) => (
              <Link key={k.id} href={`/kunjungan/${k.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{k.encounterNumber}</span>
                  <BadgeKunjungan status={k.status} />
                  <Badge variant="outline" className="bg-muted/60">
                    {ENCOUNTER_TYPE_LABELS[k.type as keyof typeof ENCOUNTER_TYPE_LABELS] ?? k.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatWaktuLengkap(k.registeredAt)}</span>
                </div>
                <p className="mt-1 text-sm">{k.chiefComplaint}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {k.diagnoses.length > 0
                    ? `Diagnosa: ${k.diagnoses.map((d) => `${d.icd10Code} ${d.display}`).join('; ')}`
                    : 'Belum ada diagnosa tercatat'}
                  {' · '}
                  {k._count.procedures} tindakan · {k._count.prescriptions} resep · {k._count.consents} persetujuan
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" /> Persetujuan ({pasien.consents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pasien.consents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada catatan persetujuan.</p>
          ) : (
            pasien.consents.map((c) => (
              <div key={c.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {CONSENT_TYPE_LABELS[c.type] ?? c.type} · {formatWaktuLengkap(c.createdAt)}
                </p>
                <p className="mt-1 text-muted-foreground">{c.agreedText}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Disetujui oleh {c.agreedByName} ({c.agreedByRole?.toLowerCase() ?? 'pasien'}) · metode {c.method.toLowerCase()}
                  {c.witnessName ? ` · saksi ${c.witnessName}` : ''}
                </p>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">
            Catatan persetujuan disimpan sebagai snapshot teks dan tidak dapat dihapus.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{nilai}</span>
    </div>
  )
}
