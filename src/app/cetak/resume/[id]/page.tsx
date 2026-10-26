import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requireOrg } from '@/lib/modules/tenant/context'
import { hasPermission } from '@/lib/modules/identity_access/roles'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import { formatTanggal, formatWaktuLengkap, hitungUmur, PAYMENT_METHOD_LABELS } from '@/lib/modules/konstanta'
import { CetakKop } from '../../kop'

export const metadata = { title: 'Resume Medis — e-SIMANTRI' }

export default async function CetakResume({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg()
  if (!hasPermission(ctx.roles, 'kunjungan.lihat')) notFound()
  const { id } = await params

  const kunjungan = await db.encounter.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      patient: true,
      organization: true,
      documents: { where: { isCurrent: true } },
      diagnoses: true,
      procedures: true,
      prescriptions: { where: { status: { not: 'DIBATALKAN' } }, include: { items: true } },
    },
  })
  if (!kunjungan || !['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status)) notFound()

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'CETAK_RESUME',
    objectType: 'Encounter',
    objectId: kunjungan.id,
    summary: `Cetak/salin resume medis ${kunjungan.encounterNumber} (${kunjungan.patient.name})`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  const doc = kunjungan.documents.find((d) => d.type === 'CATATAN_PEMERIKSAAN' && d.isCurrent)
  const isi = doc ? (JSON.parse(doc.content) as Record<string, Record<string, string>>) : null
  const odontogram = kunjungan.documents.find((d) => d.type === 'ODONTOGRAM' && d.isCurrent)

  return (
    <div className="mx-auto max-w-[720px] bg-white p-8 print:p-0">
      <CetakKop orgName={kunjungan.organization.name} alamat={kunjungan.organization.address} telepon={kunjungan.organization.phone} isSample={kunjungan.organization.isSample} judul="RESUME MEDIS" />

      <section className="mt-4 space-y-1 text-sm">
        <p><strong>Nama:</strong> {kunjungan.patient.name} <strong className="ml-4">No. RM:</strong> {kunjungan.patient.medicalRecordNumber}</p>
        <p>
          <strong>Tgl. lahir:</strong> {formatTanggal(kunjungan.patient.dateOfBirth)} ({hitungUmur(kunjungan.patient.dateOfBirth)}) ·{' '}
          <strong>JK:</strong> {kunjungan.patient.sex === 'LAKI_LAKI' ? 'Laki-laki' : kunjungan.patient.sex === 'PEREMPUAN' ? 'Perempuan' : '—'}
        </p>
        <p><strong>NIK:</strong> {kunjungan.patient.nik ?? '—'} · <strong>Penjamin:</strong> {PAYMENT_METHOD_LABELS[kunjungan.paymentMethod] ?? kunjungan.paymentMethod}</p>
        <p><strong>Riwayat alergi:</strong> {kunjungan.patient.allergiesNote ?? '—'}</p>
        <p>
          <strong>Kunjungan:</strong> {kunjungan.encounterNumber} · dibuka {formatWaktuLengkap(kunjungan.registeredAt)} · ditutup {formatWaktuLengkap(kunjungan.finishedAt ?? kunjungan.lockedAt)}
        </p>
      </section>

      <hr className="my-3" />

      <section className="space-y-3 text-sm">
        <Blok judul="Anamnesis">
          <Baris label="Keluhan utama" nilai={isi?.anamnesis?.keluhan_utama} />
          <Baris label="Riwayat penyakit sekarang" nilai={isi?.anamnesis?.riwayat_sekarang} />
          <Baris label="Riwayat penyakit dahulu" nilai={isi?.anamnesis?.riwayat_dahulu} />
          <Baris label="Riwayat alergi" nilai={isi?.anamnesis?.alergi ? `${isi.anamnesis.alergi}${isi.anamnesis.alergi_detail ? ` — ${isi.anamnesis.alergi_detail}` : ''}` : null} />
          <Baris label="Obat yang sedang dipakai" nilai={isi?.anamnesis?.obat_dipakai} />
        </Blok>

        <Blok judul="Pemeriksaan">
          <Baris label="Tanda vital" nilai={isi?.tanda_vital ? `TD ${isi.tanda_vital.td} · Nadi ${isi.tanda_vital.nadi} · Suhu ${isi.tanda_vital.suhu} · RR ${isi.tanda_vital.rr} · SpO2 ${isi.tanda_vital.spo2}` : null} />
          <Baris label="Kepala & leher" nilai={isi?.pemeriksaan?.kepala_leher ?? isi?.pemeriksaan_mulut?.mukosa} />
          <Baris label="Dada" nilai={isi?.pemeriksaan?.dada ?? isi?.pemeriksaan_mulut?.gusi} />
          <Baris label="Perut" nilai={isi?.pemeriksaan?.perut ?? isi?.pemeriksaan_mulut?.gigi} />
          <Baris label="Ekstremitas & kulit" nilai={isi?.pemeriksaan?.ekstremitas} />
          <Baris label="Hasil penunjang" nilai={isi?.penunjang?.ringkasan} />
        </Blok>

        <Blok judul="Diagnosa">
          {kunjungan.diagnoses.length === 0 ? (
            <p className="text-stone-500">—</p>
          ) : (
            <ul className="list-disc pl-5">
              {kunjungan.diagnoses.map((d) => (
                <li key={d.id}>
                  {d.icd10Code} — {d.display} {d.kind === 'UTAMA' ? '(utama)' : ''}
                </li>
              ))}
            </ul>
          )}
        </Blok>

        <Blok judul="Tindakan">
          {kunjungan.procedures.length === 0 ? (
            <p className="text-stone-500">—</p>
          ) : (
            <ul className="list-disc pl-5">
              {kunjungan.procedures.map((t) => (
                <li key={t.id}>
                  {t.name}
                  {t.icd9cmCode ? ` (ICD-9-CM ${t.icd9cmCode})` : ''}
                </li>
              ))}
            </ul>
          )}
        </Blok>

        <Blok judul="Terapi / obat">
          {kunjungan.prescriptions.length === 0 ? (
            <p className="text-stone-500">—</p>
          ) : (
            <ul className="list-disc pl-5">
              {kunjungan.prescriptions.flatMap((r) =>
                r.items.map((it) => (
                  <li key={it.id}>
                    {it.drugName} {it.strength ?? ''} {it.form ?? ''} — {it.quantity} · {it.usage}
                  </li>
                ))
              )}
            </ul>
          )}
        </Blok>

        <Blok judul="Rencana tatalaksana & edukasi">
          <Baris label="Tatalaksana" nilai={isi?.rencana?.tatalaksana} />
          <Baris label="Edukasi" nilai={isi?.rencana?.edukasi} />
          <Baris label="Tindak lanjut" nilai={isi?.rencana?.tindak_lanjut} />
        </Blok>

        {odontogram ? (
          <Blok judul="Odontogram">
            <OdontogramCetak peta={JSON.parse(odontogram.content) as Record<string, string>} />
          </Blok>
        ) : null}
      </section>

      <section className="mt-8 flex items-end justify-between text-sm">
        <div className="text-xs text-stone-500">
          <p>Dokumen ini adalah SALINAN untuk pasien.</p>
          <p>Kunjungan dikunci {formatWaktuLengkap(kunjungan.lockedAt)} oleh {kunjungan.lockedByLabel}</p>
          <p>Pencetakan oleh {ctx.auth.fullName} — {formatWaktuLengkap(new Date())}</p>
        </div>
        <div className="text-center">
          <p className="border-t pt-1 min-w-56">{kunjungan.lockedByLabel ?? kunjungan.organization.headName}</p>
          <p className="text-xs text-stone-500">Penanggung jawab pelayanan</p>
        </div>
      </section>

      <p className="mt-6 text-center text-[10px] text-stone-400">
        Lingkungan contoh — seluruh data fiktif bertanda CONTOH. Tidak ada klaim sertifikasi.
      </p>
    </div>
  )
}

function Blok({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 border-b font-semibold uppercase tracking-wide text-stone-700">{judul}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Baris({ label, nilai }: { label: string; nilai?: string | null }) {
  if (!nilai || !nilai.trim()) return null
  return (
    <p>
      <span className="text-stone-500">{label}: </span>
      {nilai}
    </p>
  )
}

function OdontogramCetak({ peta }: { peta: Record<string, string> }) {
  const entri = Object.entries(peta).filter(([, v]) => v && v !== 'SEHAT')
  if (entri.length === 0) return <p className="text-stone-500">Semua gigi sehat / tidak ada catatan.</p>
  return (
    <ul className="list-disc pl-5">
      {entri.map(([nomor, kondisi]) => (
        <li key={nomor}>
          Gigi {nomor}: {kondisi}
        </li>
      ))}
    </ul>
  )
}
