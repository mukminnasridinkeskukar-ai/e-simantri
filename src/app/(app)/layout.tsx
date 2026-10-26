// Layout grup aplikasi: penjaga akses di sisi server.
// Setiap halaman di dalam (app) hanya bisa dirender oleh sesi yang sah
// dengan organisasi aktif yang tervalidasi dari basis data.
import { requireOrg } from '@/lib/modules/tenant/context'
import { hasPermission, formatRoles, type Role } from '@/lib/modules/identity_access/roles'
import { AppShell, type NavItem } from '@/components/app-shell/app-shell'

export default async function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg()

  type Izin =
    | 'profil_praktik.lihat'
    | 'pengguna.lihat'
    | 'audit.lihat'
    | 'pasien.lihat'
    | 'kunjungan.lihat'
    | 'resep.serahkan'
    | 'klaim.lihat'
    | 'satusehat.lihat'
    | 'mutu.lihat'

  const semuaNav: Array<NavItem & { izin?: Izin }> = [
    { href: '/beranda', label: 'Beranda', icon: 'beranda' },
    { href: '/pasien', label: 'Pasien', icon: 'pasien', izin: 'pasien.lihat' },
    { href: '/kunjungan', label: 'Kunjungan', icon: 'kunjungan', izin: 'kunjungan.lihat' },
    { href: '/farmasi', label: 'Farmasi', icon: 'farmasi', izin: 'resep.serahkan' },
    { href: '/klaim', label: 'Tagihan & Klaim', icon: 'klaim', izin: 'klaim.lihat' },
    { href: '/satusehat', label: 'SATUSEHAT', icon: 'satusehat', izin: 'satusehat.lihat' },
    { href: '/mutu', label: 'Mutu & Retensi', icon: 'mutu', izin: 'mutu.lihat' },
    { href: '/profil-praktik', label: 'Profil Praktik', icon: 'profil', izin: 'profil_praktik.lihat' },
    { href: '/pengguna', label: 'Pengguna', icon: 'pengguna', izin: 'pengguna.lihat' },
    { href: '/audit', label: 'Jejak Audit', icon: 'audit', izin: 'audit.lihat' },
    { href: '/peta-modul', label: 'Peta Modul', icon: 'modul' },
    { href: '/akun', label: 'Akun Saya', icon: 'akun' },
  ]

  const navItems = semuaNav.filter(
    (item) => !item.izin || hasPermission(ctx.roles, item.izin as never)
  )

  return (
    <AppShell
      navItems={navItems}
      user={{
        fullName: ctx.auth.fullName,
        email: ctx.auth.email,
        roleLabels: formatRoles(ctx.roles as Role[]),
      }}
      org={{ name: ctx.organizationName, isSample: ctx.isSample }}
    >
      {children}
    </AppShell>
  )
}
