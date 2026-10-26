import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { JENIS_PRAKTIK_LABELS } from '@/lib/modules/tenant/jenis-praktik'
import { DialogUbahProfil } from '@/components/app-shell/dialog-ubah-profil'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MapPin, Info } from 'lucide-react'

function Baris({ label, nilai }: { label: string; nilai?: string | null }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{nilai && nilai.trim() !== '' ? nilai : <span className="text-muted-foreground font-normal">— belum diisi —</span>}</dd>
    </div>
  )
}

export default async function HalamanProfilPraktik() {
  const ctx = await requirePermission('profil_praktik.lihat')

  const [org, lokasi] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } }),
    db.location.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    }),
  ])

  const bolehUbah = hasPermission(ctx.roles, 'profil_praktik.ubah')

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Profil tempat praktik</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Identitas fasilitas pemilik dokumen rekam medis. Isi rekam medis tetap milik pasien.
          </p>
        </div>
        {bolehUbah ? <DialogUbahProfil profil={{
          name: org.name,
          practiceType: org.practiceType,
          sipNumber: org.sipNumber ?? '',
          address: org.address ?? '',
          phone: org.phone ?? '',
          email: org.email ?? '',
          headName: org.headName ?? '',
        }} /> : null}
      </div>

      {org.isSample ? (
        <Badge variant="secondary" className="text-xs">DATA CONTOH — seluruh isian adalah fiktif</Badge>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identitas fasilitas</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <Baris label="Nama tempat praktik" nilai={org.name} />
            <Baris label="Jenis praktik" nilai={JENIS_PRAKTIK_LABELS[org.practiceType] ?? org.practiceType} />
            <Baris label="Nomor SIP penyelenggara" nilai={org.sipNumber} />
            <Baris label="Alamat" nilai={org.address} />
            <Baris label="Telepon" nilai={org.phone} />
            <Baris label="Surel" nilai={org.email} />
            <Baris label="Penanggung jawab profesional" nilai={org.headName} />
            <Baris label="Status organisasi" nilai={org.status === 'AKTIF' ? 'Aktif' : org.status} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" /> Lokasi praktik
          </CardTitle>
          <CardDescription>
            Lokasi dalam satu organisasi. Pada Fase 5, lokasi ini dipetakan ke resource
            Location SATUSEHAT untuk praktik yang mengaktifkan integrasinya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lokasi.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada lokasi terdaftar.</p>
          ) : (
            <ul className="space-y-3">
              {lokasi.map((l) => (
                <li key={l.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{l.name}</p>
                    {l.isPrimary ? <Badge variant="secondary">Lokasi utama</Badge> : null}
                  </div>
                  {l.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" aria-hidden="true" /> Catatan tata kelola
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Dokumen dan berkas rekam medis adalah milik fasilitas; isi rekam medis adalah milik
            pasien. Pasien berhak memperoleh salinan isi atau ringkasan, meminta perbaikan data
            yang keliru, dan mengetahui akses terhadap datanya.
          </p>
          <Separator />
          <p>
            Penyimpanan rekam medis elektronik paling singkat 25 tahun sejak tanggal kunjungan
            terakhir. Karena itu e-SIMANTRI tidak menyediakan penghapusan isi klinis; koreksi
            dilakukan lewat amandemen yang menyimpan data asli, versi baru, alasan, dan pelaku.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
