import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requireOrg } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import { formatTanggal, formatWaktuLengkap, hitungUmur } from '@/lib/modules/konstanta'
import { CetakKop } from '../../kop'

export const metadata = { title: 'Salinan Resep — e-SIMANTRI' }

export default async function CetakResep({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg()
  if (!hasPermission(ctx.roles, 'kunjungan.lihat')) notFound()
  const { id } = await params

  const resep = await db.prescription.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      items: true,
      encounter: { include: { patient: true, organization: true } },
    },
  })
  if (!resep || resep.status === 'DIBATALKAN') notFound()

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'CETAK_RESEP',
    objectType: 'Prescription',
    objectId: resep.id,
    summary: `Cetak salinan resep ${resep.prescriptionNumber} (${resep.encounter.patient.name})`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  const org = resep.encounter.organization

  return (
    <div className="mx-auto max-w-[640px] bg-white p-8 print:p-0">
      <CetakKop orgName={org.name} alamat={org.address} telepon={org.phone} isSample={org.isSample} judul="RESEP" />

      <section className="mt-4 space-y-1 text-sm">
        <p><strong>No:</strong> {resep.prescriptionNumber} · <strong>Kunjungan:</strong> {resep.encounter.encounterNumber}</p>
        <p>
          <strong>Nama:</strong> {resep.encounter.patient.name} · <strong>No. RM:</strong>{' '}
          {resep.encounter.patient.medicalRecordNumber} · <strong>Umur:</strong> {hitungUmur(resep.encounter.patient.dateOfBirth)}
        </p>
        <p><strong>Tgl. lahir:</strong> {formatTanggal(resep.encounter.patient.dateOfBirth)}</p>
        <p><strong>Riwayat alergi:</strong> {resep.encounter.patient.allergiesNote ?? '—'}</p>
      </section>

      <hr className="my-3" />

      <ol className="space-y-2 text-sm">
        {resep.items.map((it, i) => (
          <li key={it.id} className="border-b pb-2">
            <p className="font-semibold">
              {i + 1}. {it.drugName} {it.strength ?? ''} {it.form ?? ''}
            </p>
            <p className="text-stone-600">
              Jumlah: {it.quantity} · Aturan pakai: {it.usage}
              {it.note ? ` · ${it.note}` : ''}
            </p>
          </li>
        ))}
      </ol>

      <section className="mt-8 flex items-end justify-between text-sm">
        <div className="text-xs text-stone-500">
          <p>Status penyerahan: {resep.status === 'DISELESAIKAN' ? `sudah diserahkan (${formatWaktuLengkap(resep.dispensedAt)})` : 'belum diserahkan'}</p>
          <p>Pencetakan oleh {ctx.auth.fullName} — {formatWaktuLengkap(new Date())}</p>
        </div>
        <div className="text-center">
          <p className="border-t pt-1 min-w-56">{resep.createdByLabel}</p>
          <p className="text-xs text-stone-500">Dokter penulis resep</p>
        </div>
      </section>

      <p className="mt-6 text-center text-[10px] text-stone-400">
        Lingkungan contoh — seluruh data fiktif bertanda CONTOH. Tidak ada klaim sertifikasi.
      </p>
    </div>
  )
}
