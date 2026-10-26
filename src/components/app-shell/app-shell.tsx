'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { keluar } from '@/lib/modules/identity_access/actions'
import { HeartPulse, Menu, LogOut, ChevronsUpDown, Home, Building2, Users, ScrollText, Layers, UserCircle, PersonStanding, CalendarPlus, Pill, Receipt, PlugZap, Gauge } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface NavItem {
  href: string
  label: string
  icon: string
}

export interface AppShellProps {
  navItems: NavItem[]
  user: { fullName: string; email: string; roleLabels: string[] }
  org: { name: string; isSample: boolean }
  children: React.ReactNode
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  beranda: Home,
  profil: Building2,
  pengguna: Users,
  audit: ScrollText,
  modul: Layers,
  akun: UserCircle,
  pasien: PersonStanding,
  kunjungan: CalendarPlus,
  farmasi: Pill,
  klaim: Receipt,
  satusehat: PlugZap,
  mutu: Gauge,
}

function IkonNav({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? HeartPulse
  return <Cmp className={className} />
}

function DaftarNav({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigasi utama" className="space-y-1">
      {items.map((item) => {
        const aktif = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={aktif ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 min-h-[44px] text-sm font-medium transition-colors',
              aktif
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
            )}
          >
            <IkonNav name={item.icon} className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ navItems, user, org, children }: AppShellProps) {
  const pathname = usePathname()
  const [drawerTerbuka, setDrawerTerbuka] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Bilah atas — selalu tampil (mobile & desktop) */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          {/* Tombol menu untuk layar kecil */}
          <Sheet open={drawerTerbuka} onOpenChange={setDrawerTerbuka}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden min-h-[44px] min-w-[44px]" aria-label="Buka menu navigasi">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4 bg-sidebar">
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              <div className="mb-4 flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <HeartPulse className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="font-semibold">e-SIMANTRI</span>
              </div>
              <DaftarNav items={navItems} pathname={pathname} onNavigate={() => setDrawerTerbuka(false)} />
            </SheetContent>
          </Sheet>

          {/* Identitas (desktop) */}
          <Link href="/beranda" className="hidden lg:flex items-center gap-2 mr-4">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <HeartPulse className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="font-semibold tracking-tight">e-SIMANTRI</span>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" aria-hidden="true" />
              <p className="text-sm font-medium truncate">{org.name}</p>
              {org.isSample ? <Badge variant="secondary" className="shrink-0">DATA CONTOH</Badge> : null}
            </div>
          </div>

          <div className="hidden md:block text-right mr-1">
            <p className="text-sm font-medium leading-tight">{user.fullName}</p>
            <p className="text-xs text-muted-foreground leading-tight">{user.roleLabels}</p>
          </div>

          <form action={keluar}>
            <Button variant="outline" size="sm" type="submit" className="min-h-[44px]">
              <LogOut className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-60 shrink-0 border-r bg-sidebar">
          <div className="sticky top-14 p-3">
            <DaftarNav items={navItems} pathname={pathname} />
            <div className="mt-6 rounded-lg border bg-card p-3 text-xs text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">Fase 0–8 diluncurkan</p>
              Modul klinis, SATUSEHAT (sandbox), portal pasien, dan tagihan sudah dapat dicoba pada lingkungan contoh. Lihat <Link href="/peta-modul" className="text-primary underline underline-offset-2">peta modul</Link>.
            </div>
          </div>
        </aside>

        {/* Konten */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
          <footer className="mt-auto border-t px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>e-SIMANTRI v1.0.0 — Fase 0–8 · Lingkungan contoh</span>
              <span>Lingkungan demo · data fiktif bertanda CONTOH · tidak ada klaim sertifikasi</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
