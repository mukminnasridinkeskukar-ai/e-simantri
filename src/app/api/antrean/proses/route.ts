// ============================================================
// MODUL: integration_satusehat — endpoint pekerja antrean (cron)
//
// Dipanggil pekerja terjadwal (mis. Vercel Cron). Pola keamanan:
// - Menolak berjalan bila CRON_SECRET belum diatur di lingkungan.
// - Memverifikasi header "Authorization: Bearer <CRON_SECRET>"
//   (dikirim otomatis oleh Vercel Cron bila CRON_SECRET diatur).
// - Perbandingan rahasia memakai timingSafeEqual (anti timing attack).
//
// Mode SIMULASI tidak menghasilkan trafik keluar; mode SANDBOX mengirim
// ke baseUrl milik praktik. Kegagalan tidak pernah menghapus data lokal.
// ============================================================

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { prosesAntrean } from '@/lib/modules/integration_satusehat/outbox'

export const dynamic = 'force-dynamic'

interface RingkasPraktik {
  organizationId: string
  mode: string
  diproses: number
  berhasil: number
  gagal: number
}

function samaDenganRahasia(kirim: string, rahasia: string): boolean {
  const a = Buffer.from(kirim)
  const b = Buffer.from(rahasia)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(request: Request): Promise<NextResponse> {
  const rahasia = process.env.CRON_SECRET?.trim()
  if (!rahasia) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'CRON_SECRET belum diatur di lingkungan. Endpoint cron menolak berjalan tanpa kunci rahasia.',
      },
      { status: 403 },
    )
  }

  const header = request.headers.get('authorization') ?? ''
  const kirim = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (!kirim || !samaDenganRahasia(kirim, rahasia)) {
    return NextResponse.json({ ok: false, error: 'Tidak diizinkan.' }, { status: 401 })
  }

  const aktif = await db.satusehatConfig.findMany({
    where: { enabled: true },
    select: { organizationId: true, mode: true },
  })

  const hasil: RingkasPraktik[] = []
  for (const cfg of aktif) {
    const ringkas = await prosesAntrean(cfg.organizationId, 'Pekerja terjadwal (cron)')
    hasil.push({ organizationId: cfg.organizationId, mode: cfg.mode, ...ringkas })
  }

  return NextResponse.json({
    ok: true,
    waktu: new Date().toISOString(),
    praktikDiproses: hasil.length,
    hasil,
  })
}
