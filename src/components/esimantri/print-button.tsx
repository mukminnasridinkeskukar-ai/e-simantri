'use client'

// e-SIMANTRI — Tombol cetak dokumen (Fase 4).
// Tersembunyi saat dicetak; hanya muncul pada layar.

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton({ label = 'Cetak dokumen' }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} className="min-h-11 print:hidden" variant="default">
      <Printer className="h-4 w-4" /> {label}
    </Button>
  )
}
