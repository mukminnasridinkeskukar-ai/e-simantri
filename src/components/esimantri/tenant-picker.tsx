'use client'

// ============================================================
// e-SIMANTRI — Pemilih praktik aktif (tenant picker, Fase 0)
// Satu pengguna boleh tergabung di lebih dari satu praktik dengan
// peran berbeda; peran aktif dipilih di sini dan dicatat di audit.
// ============================================================

import { useState } from 'react'
import { Check, Loader2, LogOut, Building2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { switchPraktikAction } from '@/server/actions'
import { ROLE_SHORT, type RoleKey } from '@/lib/roles'
import type { AppStatus, MembershipDTO, MeDTO } from '@/lib/dto'

export function TenantPicker({
  memberships,
  me,
  onPicked,
  onCancel,
  onLogout,
}: {
  memberships: MembershipDTO[]
  me: MeDTO | null
  onPicked: (s: AppStatus) => void
  onCancel?: () => void
  onLogout: () => Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const next = await switchPraktikAction(id)
      onPicked(next)
    } catch {
      setError('Gagal memilih praktik. Coba lagi.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Pilih praktik aktif</h1>
          {me && (
            <p className="text-sm text-muted-foreground">
              Masuk sebagai <span className="font-medium text-foreground">{me.fullName}</span> —
              pilih tempat praktik dan peran yang akan digunakan pada sesi ini.
            </p>
          )}
        </div>

        <div className="space-y-3">
          {memberships.map((m) => (
            <Card
              key={m.id}
              className="cursor-pointer transition-colors hover:border-primary/50 hover:shadow-sm"
              role="button"
              tabIndex={0}
              onClick={() => !busyId && pick(m.id)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !busyId) {
                  e.preventDefault()
                  pick(m.id)
                }
              }}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Building2 className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.organizationName}</p>
                  <p className="text-xs text-muted-foreground">
                    Peran aktif: {ROLE_SHORT[m.role as RoleKey]}
                  </p>
                </div>
                {busyId === m.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Check className="h-5 w-5 text-muted-foreground/40" aria-hidden />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="min-h-11">
              Batal
            </Button>
          )}
          <Button variant="ghost" onClick={onLogout} className="min-h-11">
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" aria-hidden />
          Pemilihan praktik dicatat pada jejak audit
          <Badge variant="outline" className="ml-1">
            PMK 24/2022
          </Badge>
        </p>
      </div>
    </div>
  )
}
