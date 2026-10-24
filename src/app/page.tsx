import { getAuthState } from '@/lib/auth'
import { AppRoot } from '@/components/esimantri/app-root'

// e-SIMANTRI — Fase 0 (Fondasi)
// Seluruh aplikasi berjalan sebagai SPA pada route `/`:
// masuk akun → verifikasi dua langkah (bila aktif) → pilih praktik
// → kerangka kerja dengan peran, profil praktik, dan jejak audit.
export default async function Page() {
  const initial = await getAuthState()
  return <AppRoot initial={initial} />
}
