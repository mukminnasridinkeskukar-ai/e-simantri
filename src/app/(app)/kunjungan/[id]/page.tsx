import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requirePermission, requireOrg } from '@/lib/modules/tenant/context'
import { hasPermission, type Role } from '@/lib/modules/identity_access/roles'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { getRequestMeta } from '@/lib/modules/identity_access/session'
import { templateUntukProfesi, cekKelengkapan, type IsiDokumen } from '@/lib/modules/clinical_document/templates'
import { EditorCatatan, FormOdontogram } from '@/components/klinis/editor-catatan'
import { Odontogram } from '@/components/klinis/odontogram'
import { TombolMulai, TombolSelesai, TombolKunci, TombolBukaKunci, TombolBatal } from '@/components/klinis/aksi-status'
import { FormDiagnosa, FormTindakan, FormResep, FormPersetujuan, FormTagihan, FormRujukan } from '@/components/klinis/form-tab-kunjungan'
import { BadgeKunjungan, BadgeOutbox, BadgeResep, BadgeTagihan } from '@/components/klinis/badge-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, FileText, Info, ListChecks, Printer } from 'lucide-react'
import {
  CONSENT_TYPE_LABELS,
  ENCOUNTER_TYPE_LABELS,
  OUTBOX_EVENT_LABELS,
  formatRupiah,
  formatWaktuLengkap,
  hitungUmur,
} from '@/lib/modules/konstanta'
import { cn } from '@/lib/utils'

const TABS = ['pemeriksaan', 'diagnosa', 'resep', 'persetujuan', 'tagihan', 'rujukan', 'kirim', 'resume'] as const
type Tab = (typeof TABS)[number]

const LABEL_TAB: Record<Tab, string> = {
  pemeriksaan: 'Pemeriksaan',
  diagnosa: 'Diagnosa & Tindakan',
  resep: 'Resep',
  persetujuan: 'Persetujuan',
  tagihan: 'Tagihan',
  rujukan: 'Rujukan',
  kirim: 'Kirim SATUSEHAT',
  resume: 'Resume & Salinan',
}

export default async function RuangKerjaKunjungan({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const ctx = await requirePermission('kunjungan.lihat')
  const { id } = await params
  const sp = await searchParams
  const tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'pemeriksaan'

  const kunjungan = await db.encounter.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      patient: true,
      documents: { orderBy: { version: 'desc' } },
      diagnoses: { orderBy: { createdAt: 'asc' } },
      procedures: { orderBy: { performedAt: 'asc' } },
      prescriptions: { orderBy: { createdAt: 'desc' }, include: { items: true } },
      consents: { orderBy: { createdAt: 'desc' } },
      invoices: { orderBy: { createdAt: 'desc' } },
      referrals: { orderBy: { createdAt: 'desc' } },
      outboxEvents: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!kunjungan) notFound()

  const { ip, userAgent } = await getRequestMeta()
  await tulisAudit({
    organizationId: ctx.organizationId,
    userId: ctx.auth.userId,
    userLabel: ctx.auth.email,
    roleLabel: ctx.roles.join(', '),
    action: 'LIHAT_KUNJUNGAN',
    objectType: 'Encounter',
    objectId: kunjungan.id,
    summary: `Membuka ruang kerja kunjungan ${kunjungan.encounterNumber} (${kunjungan.patient.name})`,
    ipAddress: ip,
    userAgent: userAgent ?? undefined,
  })

  const terkunci = ['DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status)
  const batal = kunjungan.status === 'BATAL'
  const bisaKlinis = hasPermission(ctx.roles, 'kunjungan.klinis')
  const bisaBuka = hasPermission(ctx.roles, 'kunjungan.buka')
  const bisaKunci = hasPermission(ctx.roles, 'kunjungan.kunci')

  const akun = await db.user.findUnique({ where: { id: ctx.auth.userId }, select: { profession: true } })
  const dokumenAktif = kunjungan.documents.find((d) => d.type === 'CATATAN_PEMERIKSAAN' && d.isCurrent)
  const odontogramAktif = kunjungan.documents.find((d) => d.type === 'ODONTOGRAM' && d.isCurrent)
  const isi: IsiDokumen | null = dokumenAktif ? (JSON.parse(dokumenAktif.content) as IsiDokumen) : null

  const templateLihat = templateUntukProfesi(dokumenAktif?.profession ?? akun?.profession ?? 'Dokter')
  const modeEdit = !terkunci && !batal && bisaKlinis && kunjungan.status !== 'TERDAFTAR'
  const templateEdit = templateUntukProfesi(akun?.profession ?? 'Dokter')

  const adaTerapi = kunjungan.prescriptions.some((r) => r.status !== 'DIBATALKAN')
  const kelengkapan = terkunci
    ? []
    : cekKelengkapan(templateLihat, isi, {
        adaDiagnosa: kunjungan.diagnoses.length > 0,
        adaOdontogram: Boolean(odontogramAktif),
        adaTerapi,
      })

  const [icd10, icd9cm, kfa] = await Promise.all([
    db.terminologyCode.findMany({
      where: { system: 'ICD10', isActive: true, OR: [{ organizationId: null }, { organizationId: ctx.organizationId }] },
      orderBy: { code: 'asc' },
      select: { code: true, display: true },
    }),
    db.terminologyCode.findMany({
      where: { system: 'ICD9CM', isActive: true, OR: [{ organizationId: null }, { organizationId: ctx.organizationId }] },
      orderBy: { code: 'asc' },
      select: { code: true, display: true },
    }),
    db.terminologyCode.findMany({
      where: { system: 'KFA', isActive: true, OR: [{ organizationId: null }, { organizationId: ctx.organizationId }] },
      orderBy: { display: 'asc' },
      select: { code: true, display: true, extra: true },
    }),
  ])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2 min-h-[44px]">
          <Link href={terkunci ? `/pasien/${kunjungan.patientId}` : '/kunjungan'}>
            <ArrowLeft className="mr-1 h-4 w-4" /> {terkunci ? 'Berkas pasien' : 'Daftar kunjungan'}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{kunjungan.encounterNumber}</h1>
          <BadgeKunjungan status={kunjungan.status} />
          <Badge variant="outline" className="bg-muted/60">
            {ENCOUNTER_TYPE_LABELS[kunjungan.type as keyof typeof ENCOUNTER_TYPE_LABELS] ?? kunjungan.type}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href={`/pasien/${kunjungan.patientId}`} className="font-medium text-primary underline underline-offset-2">
            {kunjungan.patient.name}
          </Link>{' '}
          · {kunjungan.patient.medicalRecordNumber} · {hitungUmur(kunjungan.patient.dateOfBirth)} ·{' '}
          {kunjungan.patient.allergiesNote ? (
            <span className="font-medium text-amber-700">Alergi: {kunjungan.patient.allergiesNote}</span>
          ) : (
            'Alergi belum dicatat'
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          Daftar {formatWaktuLengkap(kunjungan.registeredAt)}
          {kunjungan.startedAt ? ` · Mulai ${formatWaktuLengkap(kunjungan.startedAt)}` : ''}
          {kunjungan.finishedAt ? ` · Selesai ${formatWaktuLengkap(kunjungan.finishedAt)}` : ''}
          {kunjungan.lockedAt ? ` · Dikunci ${formatWaktuLengkap(kunjungan.lockedAt)} oleh ${kunjungan.lockedByLabel}` : ''}
        </p>
      </div>

      {/* Aksi status */}
      {!batal ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 py-3">
            {kunjungan.status === 'TERDAFTAR' && bisaKlinis ? <TombolMulai encounterId={kunjungan.id} /> : null}
            {kunjungan.status === 'DIPERIKSA' && bisaKlinis ? <TombolSelesai encounterId={kunjungan.id} /> : null}
            {kunjungan.status === 'SELESAI' && bisaKunci ? <TombolKunci encounterId={kunjungan.id} kelengkapan={kelengkapan} /> : null}
            {terkunci && bisaBuka ? <TombolBukaKunci encounterId={kunjungan.id} /> : null}
            {kunjungan.status === 'TERDAFTAR' ? <TombolBatal encounterId={kunjungan.id} /> : null}
            <div className="ml-auto">
              {kelengkapan.length === 0 && kunjungan.status !== 'TERDAFTAR' ? (
                <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Kelengkapan field wajib terpenuhi
                </p>
              ) : kunjungan.status !== 'TERDAFTAR' && !terkunci ? (
                <p className="flex items-center gap-1.5 text-sm text-amber-700">
                  <ListChecks className="h-4 w-4" aria-hidden="true" /> Kurang {kelengkapan.length} item kelengkapan
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Kunjungan dibatalkan{batal ? (kunjungan.canceledReason ? `: ${kunjungan.canceledReason}` : '') : ''}. Catatan tetap tersimpan.
        </p>
      )}

      {kelengkapan.length > 0 && kunjungan.status !== 'TERDAFTAR' && !terkunci ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Kelengkapan sebelum mengunci (daftar minimal PMK 24/2022)
          </p>
          <ul className="mt-1 list-disc pl-5">
            {kelengkapan.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {kunjungan.type === 'TELEMEDISIN' ? (
        <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Kunjungan telemedisin. {kunjungan.telemedicineNote ?? ''}</span>
        </p>
      ) : null}

      {/* Tab */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/kunjungan/${kunjungan.id}?tab=${t}`}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium min-h-[32px] inline-flex items-center',
              tab === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            )}
          >
            {LABEL_TAB[t]}
          </Link>
        ))}
      </div>

      {tab === 'pemeriksaan' ? (
        <div className="space-y-4">
          {kunjungan.status === 'TERDAFTAR' && !batal ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Pemeriksaan belum dimulai. Tekan &quot;Mulai pemeriksaan&quot; untuk mengisi catatan.
            </p>
          ) : null}
          {modeEdit ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Catatan pemeriksaan — {templateEdit.label}</CardTitle>
                <CardDescription>
                  Templat mengikuti profesi Anda ({akun?.profession ?? 'Dokter'}). {dokumenAktif ? `Versi aktif: ${dokumenAktif.version}.` : 'Belum ada catatan.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EditorCatatan encounterId={kunjungan.id} template={templateEdit} isi={isi} mode="edit" />
              </CardContent>
            </Card>
          ) : dokumenAktif ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Catatan pemeriksaan — {templateLihat.label}</CardTitle>
                <CardDescription>
                  Versi {dokumenAktif.version} · profesi {dokumenAktif.profession ?? '—'} · penulis {dokumenAktif.createdByLabel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EditorCatatan encounterId={kunjungan.id} template={templateLihat} isi={isi} mode="lihat" />
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada catatan pemeriksaan.</p>
          )}

          {(templateLihat.key === 'GIGI' || odontogramAktif) && !batal ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Odontogram (Fase 7)</CardTitle>
                <CardDescription>Peta kondisi 32 gigi (penomoran FDI).</CardDescription>
              </CardHeader>
              <CardContent>
                {modeEdit ? (
                  <FormOdontogram encounterId={kunjungan.id} nilai={odontogramAktif ? (JSON.parse(odontogramAktif.content) as Record<string, string>) : {}} />
                ) : odontogramAktif ? (
                  <Odontogram nilai={JSON.parse(odontogramAktif.content) as Record<string, string>} mode="lihat" />
                ) : (
                  <p className="text-sm text-muted-foreground">Odontogram belum diisi.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {kunjungan.documents.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              Riwayat versi: {kunjungan.documents.map((d) => `v${d.version}${d.isCurrent ? ' (aktif)' : ''}`).join(', ')} — tidak ada versi yang dihapus.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'diagnosa' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Diagnosa (ICD-10)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kunjungan.diagnoses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada diagnosa.</p>
              ) : (
                <ul className="space-y-2">
                  {kunjungan.diagnoses.map((d) => (
                    <li key={d.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="bg-teal-50 font-mono">
                          {d.icd10Code}
                        </Badge>
                        <span className="font-medium">{d.display}</span>
                        <Badge variant="secondary">{d.kind === 'UTAMA' ? 'Utama' : 'Sekunder'}</Badge>
                      </div>
                      {d.note ? <p className="mt-1 text-muted-foreground">{d.note}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">Dicatat {d.createdByLabel}</p>
                    </li>
                  ))}
                </ul>
              )}
              {modeEdit ? <FormDiagnosa encounterId={kunjungan.id} icd10={icd10} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tindakan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kunjungan.procedures.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada tindakan.</p>
              ) : (
                <ul className="space-y-2">
                  {kunjungan.procedures.map((t) => (
                    <li key={t.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">
                        {t.name}
                        {t.icd9cmCode ? (
                          <Badge variant="outline" className="ml-2 bg-violet-50 font-mono">
                            {t.icd9cmCode}
                          </Badge>
                        ) : null}
                      </p>
                      {t.note ? <p className="mt-1 text-muted-foreground">{t.note}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatWaktuLengkap(t.performedAt)} · pelaksana {t.performerLabel}
                        {t.consentId ? ' · persetujuan tercatat' : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {hasPermission(ctx.roles, 'tindakan.kelola') && !terkunci && !batal ? (
                <FormTindakan encounterId={kunjungan.id} icd9cm={icd9cm} />
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'resep' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resep ({kunjungan.prescriptions.length})</CardTitle>
              <CardDescription>Pengambilan obat ditandai pada menu Farmasi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {kunjungan.prescriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada resep.</p>
              ) : (
                kunjungan.prescriptions.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.prescriptionNumber}</span>
                      <BadgeResep status={r.status} />
                      <span className="text-xs text-muted-foreground">oleh {r.createdByLabel}</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {r.items.map((it) => (
                        <li key={it.id} className="flex flex-wrap gap-2">
                          <span className="font-medium">
                            {it.drugName} {it.strength ?? ''} {it.form ?? ''}
                          </span>
                          <span className="text-muted-foreground">
                            — {it.quantity} · {it.usage}
                            {it.kfaCode ? ` · KFA ${it.kfaCode}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {r.statusNote ? <p className="mt-1 text-xs text-red-700">Alasan pembatalan: {r.statusNote}</p> : null}
                    {r.dispensedByLabel ? (
                      <p className="mt-1 text-xs text-emerald-700">
                        Diserahkan oleh {r.dispensedByLabel} · {formatWaktuLengkap(r.dispensedAt)}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
              {hasPermission(ctx.roles, 'resep.kelola') && !terkunci && !batal ? (
                <FormResep encounterId={kunjungan.id} kfa={kfa} />
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'persetujuan' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Persetujuan ({kunjungan.consents.length})</CardTitle>
            <CardDescription>Snapshot teks disimpan; tidak dapat diubah atau dihapus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {kunjungan.consents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada persetujuan pada kunjungan ini.</p>
            ) : (
              kunjungan.consents.map((c) => (
                <div key={c.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{CONSENT_TYPE_LABELS[c.type] ?? c.type}</p>
                  <p className="mt-1 text-muted-foreground">{c.agreedText}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWaktuLengkap(c.createdAt)} · oleh {c.agreedByName} ({c.agreedByRole?.toLowerCase() ?? '—'}) · metode {c.method.toLowerCase()}
                  </p>
                </div>
              ))
            )}
            {hasPermission(ctx.roles, 'consent.kelola') && !terkunci && !batal ? (
              <FormPersetujuan encounterId={kunjungan.id} patientId={kunjungan.patientId} namaPasien={kunjungan.patient.name} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'tagihan' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tagihan</CardTitle>
            <CardDescription>Dibuat dari kunjungan terkunci. Tanpa integrasi BPJS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {kunjungan.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada tagihan.</p>
            ) : (
              kunjungan.invoices.map((inv) => {
                const items = JSON.parse(inv.items) as Array<{ deskripsi: string; qty: number; harga: number }>
                return (
                  <div key={inv.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{inv.invoiceNumber}</span>
                      <BadgeTagihan status={inv.status} />
                      <span className="ml-auto font-semibold">{formatRupiah(inv.total)}</span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-muted-foreground">
                      {items.map((it, i) => (
                        <li key={i}>
                          {it.deskripsi} × {it.qty} = {formatRupiah(it.qty * it.harga)}
                        </li>
                      ))}
                    </ul>
                    {inv.paidAt ? <p className="mt-1 text-xs text-emerald-700">Dibayar {formatWaktuLengkap(inv.paidAt)} via {inv.paymentMethod?.toLowerCase()}</p> : null}
                    {inv.canceledReason ? <p className="mt-1 text-xs text-red-700">Dibatalkan: {inv.canceledReason}</p> : null}
                  </div>
                )
              })
            )}
            {hasPermission(ctx.roles, 'klaim.kelola') && terkunci ? (
              <FormTagihan encounterId={kunjungan.id} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'rujukan' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rujukan keluar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kunjungan.referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada rujukan.</p>
            ) : (
              kunjungan.referrals.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    {r.letterNumber} → {r.destination}
                  </p>
                  <p className="mt-1">{r.reason}</p>
                  {r.notes ? <p className="mt-1 text-muted-foreground">{r.notes}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWaktuLengkap(r.createdAt)} · oleh {r.createdByLabel}
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-2 min-h-[44px]">
                    <Link href={`/cetak/rujukan/${r.id}`}>
                      <Printer className="mr-1 h-4 w-4" /> Cetak surat
                    </Link>
                  </Button>
                </div>
              ))
            )}
            {hasPermission(ctx.roles, 'rujukan.kelola') && ['SELESAI', 'DIKUNCI', 'TERKIRIM', 'GAGAL_KIRIM'].includes(kunjungan.status) ? (
              <FormRujukan encounterId={kunjungan.id} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'kirim' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Antrean SATUSEHAT (Fase 5)</CardTitle>
            <CardDescription>
              Kejadian dibuat saat kunjungan dikunci bila integrasi aktif. Pengiriman lewat pekerja antrean pada menu SATUSEHAT.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {kunjungan.outboxEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada kejadian antrean untuk kunjungan ini (integrasi belum aktif saat kunjungan dikunci).
              </p>
            ) : (
              kunjungan.outboxEvents.map((ev) => (
                <div key={ev.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                  <span className="font-medium">{OUTBOX_EVENT_LABELS[ev.eventType] ?? ev.eventType}</span>
                  <BadgeOutbox status={ev.status} />
                  <span className="text-xs text-muted-foreground">
                    percobaan {ev.attempts}
                    {ev.fhirResourceId ? ` · ID ${ev.fhirResourceId}` : ''}
                    {ev.sentAt ? ` · ${formatWaktuLengkap(ev.sentAt)}` : ''}
                  </span>
                  {ev.lastError ? <p className="w-full text-xs text-red-700">{ev.lastError}</p> : null}
                </div>
              ))
            )}
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link href="/satusehat">Buka antrean lengkap</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'resume' ? (
        <ResumeTab
          encounterId={kunjungan.id}
          terkunci={terkunci}
          bisaKlinis={bisaKlinis}
          isi={isi}
          diagnosa={kunjungan.diagnoses.map((d) => `${d.icd10Code} — ${d.display}${d.kind === 'UTAMA' ? ' (utama)' : ''}`)}
          tindakan={kunjungan.procedures.map((t) => `${t.name}${t.icd9cmCode ? ` (${t.icd9cmCode})` : ''}`)}
          resep={kunjungan.prescriptions
            .filter((r) => r.status !== 'DIBATALKAN')
            .flatMap((r) => r.items.map((i) => `${i.drugName} ${i.strength ?? ''} — ${i.quantity} · ${i.usage}`))}
        />
      ) : null}
    </div>
  )
}

function ResumeTab({
  encounterId,
  terkunci,
  bisaKlinis,
  isi,
  diagnosa,
  tindakan,
  resep,
}: {
  encounterId: string
  terkunci: boolean
  bisaKlinis: boolean
  isi: IsiDokumen | null
  diagnosa: string[]
  tindakan: string[]
  resep: string[]
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" /> Resume & salinan (Fase 4)
        </CardTitle>
        <CardDescription>
          Resume terbentuk dari data terkunci. Salinan untuk pasien dicetak dengan kop praktik dan tanda SALINAN.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!terkunci ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Resume final tersedia setelah kunjungan dikunci. {bisaKlinis ? 'Selesaikan pemeriksaan lalu kunci kunjungan.' : 'Menunggu penanggung jawab mengunci kunjungan.'}
          </p>
        ) : (
          <>
            <div className="grid gap-2 text-sm">
              <Ringkas label="Keluhan utama" nilai={isi?.anamnesis?.keluhan_utama} />
              <Ringkas label="Diagnosa" nilai={diagnosa.length > 0 ? diagnosa.join('; ') : null} />
              <Ringkas label="Tindakan" nilai={tindakan.length > 0 ? tindakan.join('; ') : null} />
              <Ringkas label="Terapi" nilai={resep.length > 0 ? resep.join('; ') : null} />
              <Ringkas label="Rencana tatalaksana" nilai={isi?.rencana?.tatalaksana} />
              <Ringkas label="Edukasi" nilai={isi?.rencana?.edukasi} />
              <Ringkas label="Tindak lanjut" nilai={isi?.rencana?.tindak_lanjut} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="min-h-[44px]">
                <Link href={`/cetak/resume/${encounterId}`}>
                  <Printer className="mr-2 h-4 w-4" /> Cetak resume untuk pasien
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Ringkas({ label, nilai }: { label: string; nilai?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{nilai && nilai.trim() ? nilai : '—'}</span>
    </div>
  )
}
