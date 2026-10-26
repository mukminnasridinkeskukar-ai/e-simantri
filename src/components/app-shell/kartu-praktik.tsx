'use client'

import { useActionState } from 'react'
import { pilihPraktik, type ActionState } from '@/lib/modules/identity_access/actions'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, TriangleAlert } from 'lucide-react'
import { ROLE_LABELS, type Role } from '@/lib/modules/identity_access/roles'
import type { MembershipSummary } from '@/lib/modules/tenant/context'

const stateAwal: ActionState = {}

export function KartuPraktik({ org }: { org: MembershipSummary }) {
  const [state, action, pending] = useActionState(pilihPraktik, stateAwal)

  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={org.organizationId} />
      <button
        type="submit"
        disabled={pending}
        className="w-full text-left rounded-xl border bg-card p-5 hover:border-primary/50 hover:bg-accent/40 transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring min-h-[44px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-10 w-10 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold leading-snug">{org.organizationName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Peran Anda:{' '}
                {org.roles.map((r: Role) => ROLE_LABELS[r]).join(', ')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Terdaftar sejak {org.joinedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="shrink-0 self-center">
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Memproses" />
            ) : (
              <span className="text-sm font-medium text-primary">Masuk →</span>
            )}
          </div>
        </div>
        {state.error ? (
          <Alert variant="destructive" className="mt-3">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
      </button>
    </form>
  )
}
