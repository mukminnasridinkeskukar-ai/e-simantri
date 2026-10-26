import Link from 'next/link'
import { requirePermission } from '@/lib/modules/tenant/context'
import { queryAudit, auditActionLabel } from '@/lib/modules/audit/queries'
import { PelacakBukaAudit } from '@/components/app-shell/pelacak-buka-audit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollText, Search, ShieldCheck } from 'lucide-react'

const AKSI_LIST = [
  '',
  'LOGIN',
  'LOGIN_GAGAL',
  'LOGOUT',
  'GANTI_ORGANISASI',
  'TAMBAH_PENGGUNA',
  'UBAH_PERAN',
  'STATUS_PENGGUNA',
  'RESET_SANDI',
  'UBAH_SANDI',
  'UBAH_PROFIL_PRAKTIK',
  'LIHAT_AUDIT',
]

const PERIODE_LABEL: Record<string, string> = {
  'hari-ini': 'Hari ini',
  '7-hari': '7 hari terakhir',
  '30-hari': '30 hari terakhir',
  semua: 'Semua periode',
}

function formatWaktu(d: Date): string {
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function HalamanAudit({
  searchParams,
}: {
  searchParams: Promise<{ aksi?: string; q?: string; periode?: string; halaman?: string }>
}) {
  const ctx = await requirePermission('audit.lihat')
  const sp = await searchParams

  const aksi = AKSI_LIST.includes(sp.aksi ?? '') ? sp.aksi : ''
  const q = (sp.q ?? '').slice(0, 80)
  const periode = (['hari-ini', '7-hari', '30-hari', 'semua'] as const).includes(
    sp.periode as never
  )
    ? (sp.periode ?? '30-hari')
    : '30-hari'
  const halaman = Math.max(1, parseInt(sp.halaman ?? '1', 10) || 1)

  const hasil = await queryAudit(ctx.organizationId, {
    action: aksi || undefined,
    q: q || undefined,
    periode: periode as 'hari-ini' | '7-hari' | '30-hari' | 'semua',
    page: halaman,
  })

  function tautan(h: number): string {
    const p = new URLSearchParams()
    if (aksi) p.set('aksi', aksi)
    if (q) p.set('q', q)
    p.set('periode', periode)
    p.set('halaman', String(h))
    return `/audit?${p.toString()}`
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PelacakBukaAudit />

      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Jejak audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catatan hanya-bisa-tambah (append-only): siapa, peran, kapan, dari perangkat mana,
          objek apa, dan aksi apa. Tidak dapat diubah melalui aplikasi.
        </p>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-5">
          <form method="GET" action="/audit" className="grid grid-cols-1 sm:grid-cols-[1fr_180px_180px_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="q">Cari ringkasan / pengguna</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="mis. rani, ubah peran" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aksi">Jenis aksi</Label>
              <select
                id="aksi"
                name="aksi"
                defaultValue={aksi}
                className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              >
                <option value="">Semua aksi</option>
                {AKSI_LIST.filter(Boolean).map((a) => (
                  <option key={a} value={a}>{auditActionLabel(a)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periode">Periode</Label>
              <select
                id="periode"
                name="periode"
                defaultValue={periode}
                className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              >
                {Object.entries(PERIODE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <Button type="submit" className="min-h-[44px]">
              <Search className="mr-2 h-4 w-4" /> Terapkan
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Hasil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            {hasil.total} peristiwa
          </CardTitle>
          <CardDescription>
            {PERIODE_LABEL[periode]}
            {aksi ? ` · ${auditActionLabel(aksi)}` : ''}
            {q ? ` · pencarian "${q}"` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasil.rows.length === 0 ? (
            <div className="py-10 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada peristiwa yang cocok dengan filter. Peristiwa baru muncul begitu
                pengguna beraktivitas pada praktik ini.
              </p>
            </div>
          ) : (
            <>
              {/* Tabel layar lebar */}
              <div className="hidden md:block overflow-x-auto scroll-halus">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Pengguna</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead>Ringkasan</TableHead>
                      <TableHead>Perangkat / IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hasil.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatWaktu(r.createdAt)}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium leading-tight">{r.userLabel ?? '—'}</p>
                          {r.roleLabel ? (
                            <p className="text-xs text-muted-foreground">{r.roleLabel}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.action === 'LOGIN_GAGAL' ? 'destructive' : 'secondary'}>
                            {auditActionLabel(r.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-md">{r.summary}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.ipAddress ?? '—'}
                          {r.userAgent ? (
                            <span className="block max-w-[220px] truncate">{r.userAgent}</span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Daftar layar sempit */}
              <ul className="md:hidden space-y-3">
                {hasil.rows.map((r) => (
                  <li key={r.id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={r.action === 'LOGIN_GAGAL' ? 'destructive' : 'secondary'}>
                        {auditActionLabel(r.action)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatWaktu(r.createdAt)}</span>
                    </div>
                    <p className="text-sm font-medium">{r.userLabel ?? '—'}</p>
                    {r.roleLabel ? (
                      <p className="text-xs text-muted-foreground">Peran: {r.roleLabel}</p>
                    ) : null}
                    <p className="text-sm leading-relaxed">{r.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      IP {r.ipAddress ?? '—'}
                      {r.userAgent ? ` · ${r.userAgent.slice(0, 60)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Paginasi */}
              {hasil.totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-2">
                  {halaman > 1 ? (
                    <Button asChild variant="outline" size="sm" className="min-h-[44px]">
                      <Link href={tautan(halaman - 1)}>← Sebelumnya</Link>
                    </Button>
                  ) : (
                    <span />
                  )}
                  <span className="text-sm text-muted-foreground">
                    Halaman {hasil.page} dari {hasil.totalPages}
                  </span>
                  {halaman < hasil.totalPages ? (
                    <Button asChild variant="outline" size="sm" className="min-h-[44px]">
                      <Link href={tautan(halaman + 1)}>Selanjutnya →</Link>
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
