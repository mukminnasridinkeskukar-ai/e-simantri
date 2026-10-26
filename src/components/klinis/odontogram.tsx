'use client'

// Odontogram 32 gigi (FDI) — Fase 7. Editor untuk kunjungan terbuka,
// pembaca saja untuk kunjungan terkunci. Kondisi disimpan per nomor gigi.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { KONDISI_GIGI, KONDISI_GIGI_LABELS, NOMOR_GIGI_FDI, type KondisiGigi } from '@/lib/modules/clinical_document/templates'
import { cn } from '@/lib/utils'

const WARNA_GIGI: Record<KondisiGigi, string> = {
  SEHAT: 'bg-white text-stone-700 border-stone-300',
  KARIES: 'bg-red-100 text-red-900 border-red-300',
  HILANG: 'bg-stone-200 text-stone-500 border-stone-300 line-through',
  DICABUT: 'bg-stone-300 text-stone-600 border-stone-400',
  RESTORASI: 'bg-sky-100 text-sky-900 border-sky-300',
  MAHKOTA: 'bg-amber-100 text-amber-900 border-amber-300',
  AKAR_SISA: 'bg-orange-100 text-orange-900 border-orange-300',
}

export function Odontogram({
  nilai,
  mode,
}: {
  nilai: Record<string, string>
  mode: 'edit' | 'lihat'
}) {
  const [peta, setPeta] = useState<Record<string, string>>(nilai ?? {})

  const ubah = (nomor: string) => {
    if (mode === 'lihat') return
    setPeta((lama) => {
      const sekarang = (lama[nomor] ?? 'SEHAT') as KondisiGigi
      const indeks = KONDISI_GIGI.indexOf(sekarang)
      const berikut = KONDISI_GIGI[(indeks + 1) % KONDISI_GIGI.length]
      const baru = { ...lama }
      if (berikut === 'SEHAT') delete baru[nomor]
      else baru[nomor] = berikut
      return baru
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {NOMOR_GIGI_FDI.map((baris, i) => (
          <div key={i} className={cn('flex flex-wrap gap-1.5', i === 1 && 'sm:order-3')}>
            {baris.map((nomor) => {
              const kondisi = (peta[nomor] ?? 'SEHAT') as KondisiGigi
              return (
                <button
                  key={nomor}
                  type="button"
                  onClick={() => ubah(nomor)}
                  disabled={mode === 'lihat'}
                  title={`Gigi ${nomor}: ${KONDISI_GIGI_LABELS[kondisi]}`}
                  aria-label={`Gigi ${nomor}: ${KONDISI_GIGI_LABELS[kondisi]}`}
                  className={cn(
                    'h-11 w-9 rounded-md border text-[11px] font-semibold transition-transform',
                    WARNA_GIGI[kondisi],
                    mode === 'edit' && 'hover:scale-105 active:scale-95 cursor-pointer'
                  )}
                >
                  {nomor}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {KONDISI_GIGI.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block h-3.5 w-3.5 rounded border', WARNA_GIGI[k])} aria-hidden="true" />
            {KONDISI_GIGI_LABELS[k]}
          </span>
        ))}
      </div>
      {mode === 'edit' ? (
        <p className="text-xs text-muted-foreground">
          Ketuk gigi untuk mengganti kondisi. Data disimpan bersama formulir odontogram di bawah.
        </p>
      ) : null}
      {mode === 'edit' ? <input type="hidden" name="teeth" value={JSON.stringify(peta)} /> : null}
      {mode === 'edit' ? (
        <div>
          <Button type="submit" form="form-odontogram" className="min-h-[44px]">
            Simpan odontogram
          </Button>
        </div>
      ) : null}
    </div>
  )
}
