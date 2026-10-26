// Halaman entri tunggal: mengarahkan sesuai keadaan sesi.
// - Belum masuk            -> /masuk
// - Masuk tanpa praktik    -> /pilih-praktik
// - Masuk dengan praktik   -> /beranda
import { redirect } from 'next/navigation'
import { getAuthState } from '@/lib/modules/identity_access/session'

export default async function Home() {
  const auth = await getAuthState()
  if (!auth) redirect('/masuk')
  if (!auth.activeOrganizationId) redirect('/pilih-praktik')
  redirect('/beranda')
}
