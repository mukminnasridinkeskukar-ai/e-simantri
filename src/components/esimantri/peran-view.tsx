'use client'

// ============================================================
// e-SIMANTRI — Matriks peran & hak akses (Fase 0)
// Delapan peran bawaan. Hak dapat DIPERSEMPIT per praktik,
// tidak boleh diperluas diam-diam melebihi kewenangan hukum.
// ============================================================

import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ROLE_DESCRIPTIONS,
  ROLE_KEYS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from '@/lib/roles'
import type { AppStatus } from '@/lib/dto'

const PERMISSION_LABELS: Record<string, string> = {
  'beranda.lihat': 'Beranda praktik',
  'praktik.profil.lihat': 'Melihat profil praktik',
  'praktik.profil.ubah': 'Mengubah profil praktik',
  'pengguna.lihat': 'Melihat daftar pengguna',
  'pengguna.kelola': 'Mengelola pengguna & peran',
  'peran.lihat': 'Melihat matriks peran',
  'audit.lihat': 'Melihat jejak audit',
  'akun.kelola': 'Mengelola akun sendiri',
}

export function PeranView({ state }: { state: Extract<AppStatus, { status: 'ready' }> }) {
  const myRole = state.context.role

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-lg font-semibold sm:text-xl">Peran & hak akses</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Delapan peran bawaan e-SIMANTRI. Izin selalu dihitung dari kombinasi{' '}
          <b>organisasi + peran + hubungan dengan kunjungan + kewenangan profesi</b> — pada Fase 0
          baru kombinasi organisasi + peran yang aktif. Hak dapat dipersempit oleh praktik, tidak
          boleh diperluas melebihi kewenangan hukum masing-masing profesi.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {ROLE_KEYS.map((role) => {
          const perms = ROLE_PERMISSIONS[role]
          return (
            <Card key={role} className={role === myRole ? 'border-primary/50' : undefined}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {ROLE_LABELS[role]}
                  {role === myRole && (
                    <Badge className="ml-auto" variant="default">
                      Peran Anda saat ini
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="leading-relaxed">
                  {ROLE_DESCRIPTIONS[role]}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Hak pada Fase 0
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {perms.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[11px]">
                      {PERMISSION_LABELS[p] ?? p}
                    </Badge>
                  ))}
                  {perms.length === 2 && (
                    <Badge variant="outline" className="text-[11px]">
                      Hak klinis menyusul sesuai kewenangan
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-secondary/40">
        <CardContent className="p-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            Catatan: pasien hanya dapat melihat jadwalnya, ringkasan yang sudah dikunci, permintaan
            salinan, persetujuan, dan riwayat akses terhadap berkasnya — portal pasien dihadirkan
            pada Fase 6. Admin teknis tidak memiliki akses baca isi klinis secara bawaan. Akses
            darurat (break-glass) internal praktik berbatas waktu, wajib beralasan, dan seluruhnya
            masuk jejak audit — dihadirkan bersama modul catatan klinis.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
