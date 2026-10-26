import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requireOrg } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import { formatTanggal, formatWaktuLengkap, hitungUmur } from '@/lib/modules/konstanta'
import { CetakKop } from '../../kop'

export const metadata = { title: 'Surat Rujukan — e-SIMANTRI' }

export default async function CetakRujukan({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg()
  if (!hasPermission(ctx.roles, 'kunjungan.lihat')) notFound()
  const { id } = await params

  const rujukan = await db.referral.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      encounter: { include: { patient: true, organization: true, diagnoses: true } },
    },
  })
  if (!rujukan) notFound()

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'CETAK_RUJUKAN',
    objectType: 'Referral',
    objectId: rujukan.id,
    summary: `Cetak surat rujukan ${rujukan.letterNumber} (${rujukan.encounter.patient.name})`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  const org = rujukan.encounter.organization

  return (
    <div className="mx-auto max-w-[640px] bg-white p-8 print:p-0">
      <CetakKop orgName={org.name} alamat={org.address} telepon={org.phone} isSample={org.isSample} judul="SURAT RUJUKAN" />

      <section className="mt-4 space-y-1 text-sm">
        <p><strong>No. Surat:</strong> {rujukan.letterNumber} · <strong>Tanggal:</strong> {formatWaktuLengkap(rujukan.createdAt)}</p>
        <p><strong>Kepada Yth.</strong></p>
        <p className="font-semibold">{rujukan.destination}</p>
      </section>

      <hr className="my-3" />

      <section className="space-y-1 text-sm">
        <p>
          Yang bersangkutan adalah pasien kami:
        </p>
        <p>
          <strong>Nama:</strong> {rujukan.encounter.patient.name} · <strong>No. RM:</strong> {rujukan.encounter.patient.medicalRecordNumber}
        </p>
        <p>
          <strong>Tgl. lahir:</strong> {formatTanggal(rujukan.encounter.patient.dateOfBirth)} ({hitungUmur(rujukan.encounter.patient.dateOfBirth)}) ·{' '}
          <strong>JK:</strong> {rujukan.encounter.patient.sex === 'LAKI_LAKI' ? 'Laki-laki' : rujukan.encounter.patient.sex === 'PEREMPUAN' ? 'Perempuan' : '—'}
        </p>
        <p>
          <strong>Kunjungan:</strong> {rujukan.encounter.encounterNumber} pada {formatWaktuLengkap(rujukan.encounter.registeredAt)}
        </p>
        {rujukan.encounter.diagnoses.length > 0 ? (
          <p>
            <strong>Diagnosa:</strong> {rujukan.encounter.diagnoses.map((d) => `${d.icd10Code} — ${d.display}`).join('; ')}
          </p>
        ) : null}
        <p>
          <strong>Alasan rujukan:</strong> {rujukan.reason}
        </p>
        {rujukan.notes ? (
          <p>
            <strong>Catatan:</strong> {rujukan.notes}
          </p>
        ) : null}
        <p className="mt-2">
          Mohon bantuan pemeriksaan dan penanganan lanjutan atas pasien tersebut. Atas perhatian dan kerja samanya kami
          ucapkan terima kasih.
        </p>
      </section>

      <section className="mt-8 flex items-end justify-end text-sm">
        <div className="text-center">
          <p className="text-stone-600">Hormat kami,</p>
          <p className="border-t pt-1 mt-12 min-w-56">{rujukan.createdByLabel}</p>
          <p className="text-xs text-stone-500">Tenaga medis penulis</p>
        </div>
      </section>

      <p className="mt-6 text-center text-[10px] text-stone-400">
        Lingkungan contoh — seluruh data fiktif bertanda CONTOH. Tidak ada klaim sertifikasi.
      </p>
    </div>
  )
}
