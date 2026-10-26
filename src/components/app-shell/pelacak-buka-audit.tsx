'use client'

import { useEffect, useRef } from 'react'
import { catatBukaAudit } from '@/lib/modules/audit/actions'

/// Mencatat peristiwa "membuka jejak audit" sekali per kunjungan halaman.
export function PelacakBukaAudit() {
  const sudah = useRef(false)
  useEffect(() => {
    if (sudah.current) return
    sudah.current = true
    void catatBukaAudit()
  }, [])
  return null
}
