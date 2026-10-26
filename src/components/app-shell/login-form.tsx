'use client'

import { useActionState } from 'react'
import { masuk, type ActionState } from '@/lib/modules/identity_access/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, LogIn, TriangleAlert } from 'lucide-react'

const stateAwal: ActionState = {}

export function LoginForm() {
  const [state, action, pending] = useActionState(masuk, stateAwal)

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Surel</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="nama@praktik.id"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Kata sandi</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="h-11"
        />
      </div>

      <Button type="submit" className="w-full h-11 text-base" disabled={pending}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
        {pending ? 'Memeriksa…' : 'Masuk'}
      </Button>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Sesi berlaku 12 jam. Pastikan keluar dari akun setelah memakai perangkat bersama.
        Setiap percobaan masuk tercatat pada jejak audit.
      </p>
    </form>
  )
}
