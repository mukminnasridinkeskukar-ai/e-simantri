'use client'

// ============================================================
// e-SIMANTRI — Kerangka kerja aplikasi (Fase 0)
// Sidebar + header + konten + footer, responsif hingga ±390 px
// dengan target sentuh minimal 44 px.
// ============================================================

import { useState } from 'react'
import {
  Building2,
  ClipboardCheck,
  FileText,
  Home,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Tags,
  UserCog,
  UserRound,
  Users,
  Repeat,
  DoorOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { roleHasPermission, ROLE_SHORT, type PermissionKey, type RoleKey } from '@/lib/roles'
import type { AppStatus } from '@/lib/dto'
import { BerandaView } from './beranda'
import { PraktikView } from './praktik-view'
import { PenggunaView } from './pengguna-view'
import { PeranView } from './peran-view'
import { AuditView } from './audit-view'
import { AkunView } from './akun-view'
import { PasienView } from './pasien-view'
import { KunjunganView } from './kunjungan-view'
import { CatatanView } from './catatan-view'
import { KelengkapanView } from './kelengkapan-view'
import { TerminologiView } from './terminologi-view'

export type ViewKey =
  | 'beranda'
  | 'pasien'
  | 'kunjungan'
  | 'catatan'
  | 'terminologi'
  | 'kelengkapan'
  | 'praktik'
  | 'pengguna'
  | 'peran'
  | 'audit'
  | 'akun'

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission: PermissionKey
}

const NAV_ITEMS: NavItem[] = [
  { key: 'beranda', label: 'Beranda', icon: Home, permission: 'beranda.lihat' },
  { key: 'pasien', label: 'Pasien', icon: UserRound, permission: 'pasien.lihat' },
  { key: 'kunjungan', label: 'Kunjungan', icon: DoorOpen, permission: 'kunjungan.lihat' },
  { key: 'catatan', label: 'Catatan Klinis', icon: Stethoscope, permission: 'catatan.klinis.lihat' },
  { key: 'terminologi', label: 'Terminologi', icon: Tags, permission: 'terminologi.cari' },
  { key: 'kelengkapan', label: 'Kelengkapan', icon: ClipboardCheck, permission: 'kelengkapan.dasbor.lihat' },
  { key: 'praktik', label: 'Profil Praktik', icon: Building2, permission: 'praktik.profil.lihat' },
  { key: 'pengguna', label: 'Pengguna', icon: Users, permission: 'pengguna.lihat' },
  { key: 'peran', label: 'Peran & Hak Akses', icon: ShieldCheck, permission: 'peran.lihat' },
  { key: 'audit', label: 'Jejak Audit', icon: ScrollText, permission: 'audit.lihat' },
  { key: 'akun', label: 'Akun & Keamanan', icon: UserCog, permission: 'akun.kelola' },
]

export function Shell({
  state,
  onStateChange,
  onRefresh,
  onRequestPickTenant,
  onLogout,
}: {
  state: Extract<AppStatus, { status: 'ready' }>
  onStateChange: (s: AppStatus) => void
  onRefresh: () => Promise<void>
  onRequestPickTenant: () => void
  onLogout: () => Promise<void>
}) {
  const [view, setView] = useState<ViewKey>('beranda')
  const [navOpen, setNavOpen] = useState(false)

  const role = state.context.role as RoleKey
  const allowed = NAV_ITEMS.filter((n) => roleHasPermission(role, n.permission))
  const activeItem = allowed.find((n) => n.key === view) ?? allowed[0]
  const canSwitch = state.memberships.length > 1

  function go(v: ViewKey) {
    setView(v)
    setNavOpen(false)
  }

  const navList = (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1">
      {allowed.map((item) => {
        const Icon = item.icon
        const active = item.key === activeItem.key
        return (
          <button
            key={item.key}
            onClick={() => go(item.key)}
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          {/* Navigasi seluler */}
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:hidden" aria-label="Buka menu navigasi">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="px-0">
                <SheetTitle className="text-left text-base">e-SIMANTRI</SheetTitle>
              </SheetHeader>
              <div className="mt-2">{navList}</div>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground sm:flex">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {state.context.organization.name}
              </p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Peran aktif: {ROLE_SHORT[role]}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {canSwitch && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestPickTenant}
                className="min-h-11 gap-1.5 px-3"
              >
                <Repeat className="h-4 w-4" />
                <span className="hidden sm:inline">Ganti praktik</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="min-h-11 gap-2 px-2.5" aria-label="Menu akun">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {initials(state.me.fullName)}
                  </span>
                  <span className="hidden max-w-32 truncate text-sm md:inline">
                    {state.me.fullName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <p className="truncate font-medium">{state.me.fullName}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {state.me.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => go('akun')} className="min-h-11">
                  <UserCog className="h-4 w-4" /> Akun & Keamanan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRequestPickTenant} className="min-h-11" disabled={!canSwitch}>
                  <Repeat className="h-4 w-4" /> Ganti praktik aktif
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="min-h-11">
                  <LogOut className="h-4 w-4" /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Konten */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-3 py-4 sm:px-4 sm:py-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-20 rounded-xl border bg-sidebar p-3">
            {navList}
            <div className="mt-3 border-t pt-3">
              <Badge variant="secondary" className="w-full justify-center text-[11px]">
                Fase 0–3 · Kodifikasi & resep aktif
              </Badge>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {activeItem.key === 'beranda' && (
            <BerandaView state={state} onGo={go} />
          )}
          {activeItem.key === 'pasien' && <PasienView state={state} />}
          {activeItem.key === 'kunjungan' && <KunjunganView state={state} />}
          {activeItem.key === 'catatan' && <CatatanView state={state} />}
          {activeItem.key === 'terminologi' && <TerminologiView />}
          {activeItem.key === 'kelengkapan' && <KelengkapanView />}
          {activeItem.key === 'praktik' && <PraktikView state={state} />}
          {activeItem.key === 'pengguna' && <PenggunaView state={state} />}
          {activeItem.key === 'peran' && <PeranView state={state} />}
          {activeItem.key === 'audit' && <AuditView state={state} />}
          {activeItem.key === 'akun' && <AkunView state={state} onRefresh={onRefresh} />}
        </main>
      </div>

      {/* Footer — menempel di dasar saat konten pendek */}
      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-1 px-4 py-3 text-center text-[11px] text-muted-foreground sm:flex-row sm:text-left">
          <p>
            e-SIMANTRI • Fase 0–3 (Fondasi, Kunjungan, Catatan Klinis, Terminologi & Resep) •
            Lingkungan contoh: seluruh data fiktif bertanda CONTOH
          </p>
          <p>
            Belum tersertifikasi / belum siap produksi — patuh produksi memerlukan peninjauan
            hukum & uji keamanan.
          </p>
        </div>
      </footer>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
