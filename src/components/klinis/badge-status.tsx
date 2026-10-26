import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ENCOUNTER_STATUS_LABELS,
  OUTBOX_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PRESCRIPTION_STATUS_LABELS,
  type EncounterStatus,
} from '@/lib/modules/konstanta'

const WARNA_KUNJUNGAN: Record<EncounterStatus, string> = {
  TERDAFTAR: 'bg-amber-100 text-amber-900 border-amber-200',
  DIPERIKSA: 'bg-sky-100 text-sky-900 border-sky-200',
  SELESAI: 'bg-violet-100 text-violet-900 border-violet-200',
  DIKUNCI: 'bg-teal-100 text-teal-900 border-teal-200',
  TERKIRIM: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  GAGAL_KIRIM: 'bg-red-100 text-red-900 border-red-200',
  BATAL: 'bg-stone-100 text-stone-600 border-stone-200',
}

export function BadgeKunjungan({ status, className }: { status: string; className?: string }) {
  const warna = WARNA_KUNJUNGAN[status as EncounterStatus] ?? 'bg-stone-100 text-stone-700'
  return (
    <Badge variant="outline" className={cn(warna, className)}>
      {ENCOUNTER_STATUS_LABELS[status as EncounterStatus] ?? status}
    </Badge>
  )
}

const WARNA_OUTBOX: Record<string, string> = {
  ANTRE: 'bg-amber-100 text-amber-900 border-amber-200',
  TERKIRIM: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  GAGAL_VALIDASI: 'bg-orange-100 text-orange-900 border-orange-200',
  GAGAL_KIRIM: 'bg-red-100 text-red-900 border-red-200',
}

export function BadgeOutbox({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn(WARNA_OUTBOX[status] ?? 'bg-stone-100 text-stone-700', className)}>
      {OUTBOX_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

const WARNA_TAGIHAN: Record<string, string> = {
  DRAFT: 'bg-stone-100 text-stone-700 border-stone-200',
  TERBIT: 'bg-amber-100 text-amber-900 border-amber-200',
  DIBAYAR: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  DIBATALKAN: 'bg-red-100 text-red-900 border-red-200',
}

export function BadgeTagihan({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn(WARNA_TAGIHAN[status] ?? 'bg-stone-100', className)}>
      {INVOICE_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

const WARNA_RESEP: Record<string, string> = {
  DIBUAT: 'bg-amber-100 text-amber-900 border-amber-200',
  DISELESAIKAN: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  DIBATALKAN: 'bg-red-100 text-red-900 border-red-200',
}

export function BadgeResep({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn(WARNA_RESEP[status] ?? 'bg-stone-100', className)}>
      {PRESCRIPTION_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
