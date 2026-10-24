'use client'

// ============================================================
// e-SIMANTRI — Akar aplikasi (SPA, Fase 0)
// Mengatur alur: masuk → 2FA → pilih praktik → kerangka kerja.
// ============================================================

import { useCallback, useState } from 'react'
import type { AppStatus } from '@/lib/dto'
import { getContextAction } from '@/server/actions'
import { LoginView } from './login-view'
import { TenantPicker } from './tenant-picker'
import { Shell } from './shell'
import { Loader2, ShieldAlert, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { logoutAction } from '@/server/actions'

export function AppRoot({ initial }: { initial: AppStatus }) {
  const [state, setState] = useState<AppStatus>(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [pickingTenant, setPickingTenant] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const next = await getContextAction()
      setState(next)
      setPickingTenant(false)
    } finally {
      setRefreshing(false)
    }
  }, [])

  async function handleLogout() {
    await logoutAction()
    setPickingTenant(false)
    setState({ status: 'logged_out' })
  }

  if (refreshing && state.status === 'logged_out') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Memuat" />
      </div>
    )
  }

  if (state.status === 'logged_out') {
    return <LoginView onAuthenticated={refresh} />
  }

  if (state.status === 'pending_2fa') {
    return <LoginView onAuthenticated={refresh} twoFaPendingEmail={state.email} />
  }

  if (state.status === 'no_membership') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Belum tergabung di praktik
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Akun Anda belum terhubung ke tempat praktik mana pun. Hubungi penanggung jawab
              praktik untuk ditambahkan sebagai pengguna dengan peran yang sesuai kewenangan Anda.
            </p>
            <Button variant="outline" onClick={handleLogout} className="w-full min-h-11">
              <LogOut className="h-4 w-4" /> Keluar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const showPicker = pickingTenant || state.status === 'pick_tenant'
  if (showPicker) {
    const memberships =
      state.status === 'ready' || state.status === 'pick_tenant' ? state.memberships : []
    const me = state.status === 'ready' || state.status === 'pick_tenant' ? state.me : null
    return (
      <TenantPicker
        memberships={memberships}
        me={me}
        onPicked={(s) => {
          setState(s)
          setPickingTenant(false)
        }}
        onCancel={state.status === 'ready' ? () => setPickingTenant(false) : undefined}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <Shell
      state={state}
      onStateChange={setState}
      onRefresh={refresh}
      onRequestPickTenant={() => setPickingTenant(true)}
      onLogout={handleLogout}
    />
  )
}
