// ============================================================
// e-SIMANTRI — Halaman cetak dokumen pasien (Fase 4)
// Route /cetak/[documentId] — berdiri sendiri di luar kerangka
// aplikasi agar bersih saat dicetak (A4).
//
// Aturan:
// - Hanya pemegang izin dokumen.lihat dari praktik yang sama.
// - Buka oleh pihak selain penerbit otomatis diaudit (DOKUMEN_DILIHAT)
//   lewat getDocumentForPrintAction.
// - Isi bersumber dari SNAPSHOT penerbitan — bukan data langsung.
// ============================================================

import type { Metadata } from 'next'
import Link from 'next/link'
import { getAuthState } from '@/lib/auth'
import { roleHasPermission } from '@/lib/roles'
import { describeKind, sexLabel, docRelationLabel } from '@/lib/payer'
import { getDocumentForPrintAction } from '@/server/documents'
import { PrintButton } from '@/components/esimantri/print-button'
import type { SummaryDocDetailDTO } from '@/lib/dto'

export const metadata: Metadata = {
  title: 'Cetak Dokumen — e-SIMANTRI',
  robots: { index: false, follow: false },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'long' })
}

function fmtDT(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

// Label bagian catatan sesuai isi minimum PMK 24/2022
const SECTION_LABELS: { key: keyof SummaryDocDetailDTO['content']['note']; label: string }[] = [
  { key: 'subjective', label: 'Keluhan utama dan riwayat penyakit' },
  { key: 'allergiesNote', label: 'Alergi dan riwayat pemakaian obat yang relevan' },
  { key: 'objective', label: 'Hasil pemeriksaan fisik/tambahan' },
  { key: 'supportingExam', label: 'Hasil pemeriksaan penunjang' },
  { key: 'assessment', label: 'Diagnosis' },
  { key: 'plan', label: 'Rencana penatalaksanaan' },
  { key: 'medsGiven', label: 'Obat/tindakan yang diberikan' },
  { key: 'otherServices', label: 'Pelayanan lainnya' },
  { key: 'education', label: 'Edukasi yang diberikan' },
  { key: 'followUpPlan', label: 'Rencana tindak lanjut/kontrol' },
]

// Bagian yang tampil pada RINGKASAN PELAYANAN (ringkas, bukan salinan penuh)
const RINGKASAN_SECTIONS = [
  'subjective',
  'assessment',
  'plan',
  'medsGiven',
  'education',
  'followUpPlan',
] as const

export default async function CetakDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params
  const state = await getAuthState()
  const allowed =
    state.status === 'ready' && roleHasPermission(state.context.role, 'dokumen.lihat')
  if (!allowed) return <Denied />
  const doc = await getDocumentForPrintAction(documentId)
  if (!doc) return <Denied message="Dokumen tidak ditemukan pada praktik aktif Anda." />

  const isRingkasan = doc.kind === 'RINGKASAN_PELAYANAN'
  const sections = isRingkasan
    ? SECTION_LABELS.filter((s) => (RINGKASAN_SECTIONS as readonly string[]).includes(s.key))
    : SECTION_LABELS

  return (
    <div className="min-h-screen bg-slate-200 py-4 text-slate-900 print:bg-white print:py-0">
      {/* Bilah aksi — hanya layar */}
      <div className="mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-2 px-2 print:hidden">
        <Link href="/" className="text-sm text-slate-600 underline hover:text-slate-900">
          ← Kembali ke aplikasi
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto w-full max-w-[210mm] bg-white p-8 text-[13px] leading-relaxed shadow print:max-w-none print:p-0 print:shadow-none">
        {/* Kop surat */}
        <header className="border-b-4 border-double border-slate-900 pb-3">
          {doc.org.letterheadText ? (
            <p className="whitespace-pre-line text-center font-semibold uppercase">
              {doc.org.letterheadText}
            </p>
          ) : (
            <div className="text-center">
              <p className="text-base font-bold uppercase">{doc.org.name}</p>
              <p className="text-[11px] leading-snug">
                {[doc.org.address, [doc.org.city, doc.org.province].filter(Boolean).join(', ')]
                  .filter(Boolean)
                  .join(' — ')}
                {doc.org.phone ? ` — Telp. ${doc.org.phone}` : ''}
                {doc.org.email ? ` — ${doc.org.email}` : ''}
              </p>
            </div>
          )}
          {doc.org.sipNumber && (
            <p className="mt-1 text-center text-[10px] text-slate-600">
              SIP penyelenggara: {doc.org.sipNumber}
            </p>
          )}
        </header>

        {/* Judul dokumen */}
        <div className="mt-5 text-center">
          <h1 className="text-lg font-bold uppercase underline">
            {describeKind(doc.kind)}
          </h1>
          <p className="mt-0.5 text-[12px]">Nomor: {doc.number}</p>
        </div>

        {/* Identitas pasien */}
        <section className="mt-5">
          <h2 className="mb-1 text-[12px] font-bold uppercase">Identitas pasien</h2>
          <table className="w-full">
            <tbody>
              <InfoRow label="Nama" value={doc.patient.fullName} />
              <InfoRow label="No. rekam medis" value={doc.patient.mrn} />
              <InfoRow label="NIK" value={doc.patient.nationalIdMasked ?? '—'} />
              <InfoRow label="Tanggal lahir" value={fmtDate(doc.patient.dateOfBirth)} />
              <InfoRow label="Jenis kelamin" value={sexLabel(doc.patient.sex)} />
            </tbody>
          </table>
        </section>

        {/* Waktu pelayanan */}
        <section className="mt-4">
          <h2 className="mb-1 text-[12px] font-bold uppercase">Waktu pelayanan</h2>
          <table className="w-full">
            <tbody>
              <InfoRow label="Kunjungan dibuka" value={fmtDT(doc.content.openedAt)} />
              <InfoRow label="Kunjungan selesai" value={fmtDT(doc.content.closedAt)} />
            </tbody>
          </table>
        </section>

        {/* Isi catatan */}
        <section className="mt-4">
          <h2 className="mb-1 text-[12px] font-bold uppercase">
            {isRingkasan ? 'Ringkasan pelayanan' : 'Isi catatan klinis (PMK 24/2022)'}
          </h2>
          <div className="space-y-2">
            {sections.map((s) => (
              <div key={s.key} className="break-inside-avoid">
                <p className="font-semibold">{s.label}</p>
                <p className="whitespace-pre-line">{doc.content.note[s.key]?.trim() || '—'}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Kodifikasi */}
        {(doc.content.diagnoses.length > 0 || doc.content.procedures.length > 0) && (
          <section className="mt-4 break-inside-avoid">
            <h2 className="mb-1 text-[12px] font-bold uppercase">Kodifikasi</h2>
            {doc.content.diagnoses.length > 0 && (
              <ul className="list-disc pl-5">
                {doc.content.diagnoses.map((d, i) => (
                  <li key={`dx-${i}`}>
                    <span className="font-mono font-semibold">{d.code}</span> — {d.description}
                    {d.isPrimary ? ' (utama)' : ''}
                    {d.noteText ? `; ${d.noteText}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {doc.content.procedures.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {doc.content.procedures.map((p, i) => (
                  <li key={`pr-${i}`}>
                    <span className="font-mono font-semibold">{p.code}</span> — {p.description}
                    {p.noteText ? `; ${p.noteText}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Resep */}
        {doc.content.prescriptions.some((r) => r.status === 'AKTIF') && (
          <section className="mt-4 break-inside-avoid">
            <h2 className="mb-1 text-[12px] font-bold uppercase">Resep yang diberikan</h2>
            {doc.content.prescriptions
              .filter((r) => r.status === 'AKTIF')
              .map((r) => (
                <div key={r.number} className="mb-2">
                  <p className="font-semibold">Resep No. {r.number}</p>
                  <table className="mt-1 w-full border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100 text-left text-[11px] uppercase">
                        <th className="border border-slate-400 px-1.5 py-1">Obat</th>
                        <th className="border border-slate-400 px-1.5 py-1">Aturan pakai</th>
                        <th className="border border-slate-400 px-1.5 py-1">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((it, i) => (
                        <tr key={`it-${i}`}>
                          <td className="border border-slate-400 px-1.5 py-1">
                            {it.drugName}
                            {it.route ? ` — ${it.route.toLowerCase()}` : ''}
                          </td>
                          <td className="border border-slate-400 px-1.5 py-1">
                            {[it.dose, it.frequency, it.durationDays ? `${it.durationDays} hari` : null, it.instructions]
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </td>
                          <td className="border border-slate-400 px-1.5 py-1">{it.quantity ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </section>
        )}

        {/* Penerima & keperluan */}
        <section className="mt-4">
          <table className="w-full">
            <tbody>
              <InfoRow
                label="Dokumen diberikan kepada"
                value={
                  doc.recipientRelation === 'PASIEN'
                    ? 'Pasien sendiri'
                    : `${docRelationLabel(doc.recipientRelation)}${doc.recipientName ? ` — ${doc.recipientName}` : ''}`
                }
              />
              <InfoRow label="Keperluan" value={doc.purpose} />
            </tbody>
          </table>
        </section>

        {/* Penutup + tanda tangan */}
        <div className="mt-6 flex flex-wrap justify-between gap-6 break-inside-avoid">
          <div className="max-w-[60%] text-[10px] leading-snug text-slate-600">
            <p>
              Dokumen ini diterbitkan dari rekam medis elektronik {doc.org.name} melalui
              e-SIMANTRI dan merupakan {isRingkasan ? 'ringkasan' : 'salinan'} isi catatan pada
              waktu penerbitan (catatan versi {doc.content.noteVersion}, status{' '}
              {doc.content.noteStatus === 'TERKUNCI' ? 'terkunci' : doc.content.noteStatus.toLowerCase()}).
            </p>
            <p className="mt-1">
              Diterbitkan {fmtDT(doc.issuedAt)} oleh {doc.issuedByName}. Keaslian dapat
              diverifikasi pada praktik penerbit.
            </p>
          </div>
          <div className="ml-auto text-center text-[12px]">
            <p className="mb-12">{doc.org.city || doc.org.name}, {fmtDate(doc.issuedAt)}</p>
            <p className="border-t border-slate-900 px-6 pt-1">
              <span className="font-semibold">{doc.content.authorName}</span>
              <br />
              {doc.content.authorProfession ?? '—'}
              {doc.content.authorStrNumber ? ` · STR ${doc.content.authorStrNumber}` : ''}
            </p>
          </div>
        </div>
      </article>

      <p className="mx-auto mt-2 max-w-[210mm] px-2 text-center text-[10px] text-slate-500 print:hidden">
        Gunakan fungsi cetak peramban untuk menyimpan sebagai PDF atau mencetak ke kertas A4.
      </p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="w-52 align-top py-0.5 pr-2 text-slate-600">{label}</td>
      <td className="py-0.5 font-medium">{value}</td>
    </tr>
  )
}

function Denied({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 text-center shadow">
        <h1 className="text-base font-semibold text-slate-900">Akses ditolak</h1>
        <p className="mt-1 text-sm text-slate-600">
          {message ??
            'Halaman ini hanya dapat dibuka oleh pengguna praktik terkait dengan izin dokumen yang memadai. Masuk terlebih dahulu melalui aplikasi e-SIMANTRI.'}
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Buka aplikasi
        </Link>
      </div>
    </div>
  )
}
