'use client'

// ============================================================
// e-SIMANTRI — Beranda praktik (Fase 0)
// Menampilkan status fondasi, peta fase, catatan rilis, dan
// daftar yang sengaja ditunda sesuai arah kerja per fase.
// ============================================================

import {
  Activity,
  CheckCircle2,
  CircleDashed,
  FileText,
  Stethoscope,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ROLE_SHORT, type RoleKey } from '@/lib/roles'
import type { AppStatus } from '@/lib/dto'
import type { ViewKey } from './shell'

const PHASES: { n: number; title: string; desc: string; aktif: boolean }[] = [
  { n: 0, title: 'Fondasi', desc: 'Kerangka aplikasi, tenant, masuk akun, peran, audit, profil praktik, data contoh', aktif: true },
  { n: 1, title: 'Registrasi & kunjungan', desc: 'Pasien, antrean hari ini, buka kunjungan, status kunjungan', aktif: true },
  { n: 2, title: 'Catatan klinis dokter umum', desc: 'Formulir wajib PMK, versi, kunci catatan, larangan hapus, dasbor kelengkapan', aktif: true },
  { n: 3, title: 'Diagnosis, tindakan, resep', desc: 'ICD-10, ICD-9-CM, KFA; resep dan tindakan menempel pada kunjungan terkunci', aktif: false },
  { n: 4, title: 'Resume & salinan pasien', desc: 'Ringkasan terstruktur, unduh salinan, jejak pencetakan', aktif: false },
  { n: 5, title: 'Adapter SATUSEHAT', desc: 'Mapper FHIR, outbox, antrean sandbox, kredensial per praktik', aktif: false },
  { n: 6, title: 'Portal pasien & consent', desc: 'Akun pasien terbatas, persetujuan, riwayat akses', aktif: false },
  { n: 7, title: 'Mutu, retensi, telemedisin, templat profesi lain', desc: 'Odontogram, templat bidan/perawat/gizi/fisioterapi, retensi 25 tahun', aktif: false },
  { n: 8, title: 'Klaim & rujukan', desc: 'Antarmuka BPJS/klaim dan SISRUTE lewat modul terpisah', aktif: false },
]

export function BerandaView({
  state,
  onGo,
}: {
  state: Extract<AppStatus, { status: 'ready' }>
  onGo: (v: ViewKey) => void
}) {
  const role = state.context.role as RoleKey
  const me = state.me

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sapaan */}
      <section>
        <h1 className="text-lg font-semibold sm:text-xl">
          Selamat datang, {me.fullName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {state.context.organization.name} — sesi aktif dengan peran{' '}
          <span className="font-medium text-foreground">{ROLE_SHORT[role]}</span>.
          {me.totpEnabled
            ? ' Verifikasi dua langkah aktif.'
            : ' Verifikasi dua langkah belum aktif — aktifkan di Akun & Keamanan.'}
        </p>
      </section>

      {/* Kartu status modul */}
      <section aria-label="Status modul" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Tenant & Isolasi"
          desc="Seluruh akses terlingkup praktik aktif dari sesi server; data antarpraktik terisolasi."
          ok
        />
        <StatusCard
          icon={<UserRound className="h-4 w-4" />}
          title="Pasien & Kunjungan"
          desc="Registrasi identitas, no. RM otomatis, buka/tutup kunjungan dengan waktu tercatat (Fase 1)."
          ok
        />
        <StatusCard
          icon={<Stethoscope className="h-4 w-4" />}
          title="Catatan Klinis Dokter"
          desc="Formulir PMK 24/2022, kunci dengan validasi kelengkapan, amandemen beralasan, tanpa hapus (Fase 2)."
          ok
        />
        <StatusCard
          icon={<FileText className="h-4 w-4" />}
          title="Terminologi & Resep"
          desc="ICD-10, ICD-9-CM, dan KFA (resep terstruktur) menyusul pada Fase 3."
          ok={false}
        />
      </section>

      {/* Peta fase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Peta pengembangan
          </CardTitle>
          <CardDescription>
            Satu fase setiap giliran. Fase 0–2 sudah bisa dicoba; Fase 3 hanya dibangun setelah
            Fase 2 teruji di lapangan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {PHASES.map((p) => (
              <li
                key={p.n}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  p.aktif ? 'border-primary/40 bg-primary/5' : ''
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    p.aktif ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {p.n}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">
                    {p.title}
                    {p.aktif && (
                      <Badge className="ml-2 align-middle" variant="default">
                        Fase ini
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                {p.aktif ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-label="Aktif" />
                ) : (
                  <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-label="Ditunda" />
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Catatan rilis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Catatan rilis — Fase 1 & 2
            </CardTitle>
            <CardDescription>Yang sudah bisa dipakai, di atas fondasi Fase 0.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              <li>Registrasi pasien dengan nomor rekam medis otomatis per praktik; NIK tersamarkan pada daftar.</li>
              <li>Pasien tidak dapat dihapus — pasien ganda dinonaktifkan dan tetap tersimpan.</li>
              <li>Buka/tutup kunjungan dengan tanggal-jam buka-tutup otomatis (isi minimum PMK 24/2022).</li>
              <li>Catatan klinis dokter umum per kunjungan dengan bagian wajib PMK 24/2022.</li>
              <li>Penguncian menolak bila bagian wajib belum lengkap; kunjungan ikut ditutup saat catatan dikunci.</li>
              <li>Koreksi catatan terkunci hanya lewat amandemen beralasan — versi lama dipertahankan dan dapat dilihat.</li>
              <li>Dasbor kelengkapan untuk Rekam Medis & Penanggung Jawab (metadata, tanpa isi klinis).</li>
              <li>Akses isi catatan oleh pihak bukan penulis selalu tercatat pada jejak audit.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sengaja ditunda</CardTitle>
            <CardDescription>
              Belum dibangun agar fondasi tidak melompat ke integrasi produksi terlalu dini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              <li>Kode diagnosis ICD-10, kode tindakan ICD-9-CM, dan obat KFA; resep terstruktur (Fase 3).</li>
              <li>Resume kunjungan terstruktur, salinan untuk pasien, jejak pencetakan (Fase 4).</li>
              <li>Adapter SATUSEHAT — kredensial belum dikonfigurasi sama sekali (Fase 5, sandbox saja).</li>
              <li>Portal pasien, consent, riwayat akses pasien (Fase 6).</li>
              <li>Templat klinis profesi lain (bidan, perawat, gizi, fisioterapi), odontogram dokter gigi, asuhan PPA pendamping — titik sambung sudah disiapkan (Fase 7).</li>
              <li>Tanda tangan elektronik tersertifikasi (TTE) — fase lanjutan.</li>
              <li>Klaim BPJS dan rujukan SISRUTE (Fase 8, lewat antarmuka).</li>
            </ul>
            <Separator />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Catatan kepatuhan: diagnosis Fase 2 masih teks bebas — pengkodean ICD-10 dan tindakan
              menyusul Fase 3 sebelum integrasi apa pun dibangun. Tidak ada klaim sertifikasi
              Kemenkes atau kesiapan produksi. Koreksi terkunci lewat amandemen beralasan sudah
              berjalan; retensi 25 tahun perlu kebijakan arsip di sisi infrastruktur Anda.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  desc,
  ok,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  ok: boolean
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md ${
            ok ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {icon}
        </span>
        <p className="text-sm font-medium">{title}</p>
        <Badge variant={ok ? 'default' : 'secondary'} className="ml-auto text-[10px]">
          {ok ? 'Aktif' : 'Fase 1+'}
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </Card>
  )
}
