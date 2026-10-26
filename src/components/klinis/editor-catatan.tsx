'use client'

// Editor catatan pemeriksaan berbasis templat profesi (Fase 2).
// Menyimpan VERSI BARU setiap kali disimpan (versi lama tetap ada).
// PPA pendamping dibatasi server pada bagian asesmen.

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { simpanCatatan, simpanOdontogram, type AksiState } from '@/lib/modules/clinical_document/doc-actions'
import { Odontogram } from './odontogram'
import type { TemplateDef } from '@/lib/modules/clinical_document/templates'
import { Save, AlertTriangle } from 'lucide-react'

export function EditorCatatan({
  encounterId,
  template,
  isi,
  mode,
}: {
  encounterId: string
  template: TemplateDef
  isi: Record<string, Record<string, string>> | null
  mode: 'edit' | 'lihat'
}) {
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(simpanCatatan, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="encounterId" value={encounterId} />
      {template.sections.map((bagian) => {
        const nilaiBagian = isi?.[bagian.key] ?? {}
        return (
          <fieldset key={bagian.key} className="rounded-lg border p-4 space-y-3">
            <legend className="px-1 text-sm font-semibold">{bagian.label}</legend>
            {bagian.description ? <p className="text-xs text-muted-foreground">{bagian.description}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {bagian.fields.map((f) => {
                const id = `${bagian.key}-${f.key}`
                const nilai = nilaiBagian[f.key] ?? ''
                if (f.type === 'select') {
                  return (
                    <div key={f.key} className="grid gap-1.5">
                      <Label htmlFor={id}>
                        {f.label}
                        {f.required ? ' *' : ''}
                      </Label>
                      <Select name={`${bagian.key}.${f.key}`} defaultValue={nilai || undefined} disabled={mode === 'lihat'}>
                        <SelectTrigger id={id} className="w-full min-h-[44px]">
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                }
                return (
                  <div key={f.key} className={cnGrid(f.type)}>
                    <Label htmlFor={id}>
                      {f.label}
                      {f.required ? ' *' : ''}
                      {f.unit ? ` (${f.unit})` : ''}
                    </Label>
                    {f.type === 'textarea' ? (
                      <Textarea id={id} name={`${bagian.key}.${f.key}`} defaultValue={nilai} rows={2} disabled={mode === 'lihat'} />
                    ) : (
                      <Input
                        id={id}
                        name={`${bagian.key}.${f.key}`}
                        type={f.type === 'number' ? 'number' : 'text'}
                        step="any"
                        inputMode={f.type === 'number' ? 'decimal' : undefined}
                        defaultValue={nilai}
                        disabled={mode === 'lihat'}
                        className="min-h-[44px]"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </fieldset>
        )
      })}

      {mode === 'edit' ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Setiap penyimpanan membuat <strong>versi baru</strong>. Versi sebelumnya tidak dapat dihapus — seluruh riwayat
            tersimpan untuk keperluan rekam medis.
          </span>
        </div>
      ) : null}

      {state.error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
          {state.kurang && state.kurang.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {state.kurang.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}

      {mode === 'edit' ? (
        <Button type="submit" disabled={menunggu} className="min-h-[44px] w-full sm:w-auto">
          <Save className="mr-2 h-4 w-4" />
          {menunggu ? 'Menyimpan…' : 'Simpan catatan (versi baru)'}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Kunjungan terkunci — catatan hanya dapat dibaca.</p>
      )}
    </form>
  )
}

function cnGrid(tipe: string): string {
  return tipe === 'textarea' ? 'grid gap-1.5 sm:col-span-2' : 'grid gap-1.5'
}

export function FormOdontogram({ encounterId, nilai }: { encounterId: string; nilai: Record<string, string> }) {
  const [state, formAction, menunggu] = useActionState<AksiState, FormData>(simpanOdontogram, {})
  return (
    <form id="form-odontogram" action={formAction} className="space-y-3">
      <input type="hidden" name="encounterId" value={encounterId} />
      <Odontogram nilai={nilai} mode="edit" />
      {state.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
      {menunggu ? <p className="text-sm text-muted-foreground">Menyimpan…</p> : null}
    </form>
  )
}
