import { redirect } from 'next/navigation'
import { getAuthState } from '@/lib/modules/identity_access/session'
import { LoginForm } from '@/components/app-shell/login-form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { HeartPulse, ShieldCheck, ScrollText, Database } from 'lucide-react'

export default async function HalamanMasuk() {
  const auth = await getAuthState()
  if (auth) redirect(auth.activeOrganizationId ? '/beranda' : '/pilih-praktik')

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sisi identitas produk */}
        <section className="bg-sidebar border-b lg:border-b-0 lg:border-r lg:w-[42%] px-6 py-10 lg:px-12 lg:py-16 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <HeartPulse className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xl font-semibold tracking-tight">e-SIMANTRI</p>
                <p className="text-xs text-muted-foreground">
                  Sistem Informasi Manajemen Praktik Mandiri Terintegrasi
                </p>
              </div>
            </div>

            <h1 className="mt-8 text-2xl lg:text-3xl font-semibold leading-snug max-w-md">
              Rekam medis elektronik untuk tempat praktik mandiri.
            </h1>
            <p className="mt-3 text-muted-foreground max-w-md leading-relaxed">
              Satu platform untuk banyak tempat praktik. Satu pasien, satu rekam medis
              berkesinambungan. Data antarpraktik terisolasi ketat.
            </p>
          </div>

          <ul className="mt-10 space-y-4 text-sm text-muted-foreground max-w-md">
            <li className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Autentikasi pengguna, peran sesuai kewenangan profesi, dan jejak audit
                yang tidak dapat diubah pengguna.
              </span>
            </li>
            <li className="flex gap-3">
              <ScrollText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Disusun mengacu pada PMK 24/2022 tentang Rekam Medis, UU Kesehatan,
                UU Pelindungan Data Pribadi, serta pedoman interoperabilitas SATUSEHAT.
              </span>
            </li>
            <li className="flex gap-3">
              <Database className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Lingkungan demo memakai data fiktif yang selalu ditandai CONTOH.
                Tidak ada data pasien sungguhan.
              </span>
            </li>
          </ul>
        </section>

        {/* Sisi formulir */}
        <section className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Masuk ke akun Anda</CardTitle>
                <CardDescription>
                  Gunakan surel dan kata sandi yang diberikan penanggung jawab praktik.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LoginForm />
              </CardContent>
            </Card>

            <div className="mt-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="akun-contoh">
                  <AccordionTrigger className="text-sm">
                    Akun contoh untuk mencoba (lingkungan demo)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Semua akun CONTOH</Badge>
                        <Badge variant="secondary">Kata sandi: Contoh#2026</Badge>
                      </p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li><span className="font-medium text-foreground">andi@contoh.id</span> — dr. Andi Wijaya (Penanggung Jawab + PPA)</li>
                        <li><span className="font-medium text-foreground">budi@contoh.id</span> — drg. Budi Santoso (PPA Dokter Gigi)</li>
                        <li><span className="font-medium text-foreground">ayu@contoh.id</span> — Ni Made Ayu Lestari (PPA Pendamping)</li>
                        <li><span className="font-medium text-foreground">ani@contoh.id</span> — Ani Puspita (Pendaftaran)</li>
                        <li><span className="font-medium text-foreground">rani@contoh.id</span> — Rani Kusuma (Rekam Medis)</li>
                        <li><span className="font-medium text-foreground">sari@contoh.id</span> — Sari Dewi (Kasir)</li>
                        <li><span className="font-medium text-foreground">tono@contoh.id</span> — Tono Prakoso (Admin Teknis)</li>
                        <li><span className="font-medium text-foreground">siti@contoh.id</span> — Siti Aminah (Pasien)</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <p className="mt-6 text-xs text-muted-foreground text-center">
              e-SIMANTRI Fase 0 — Fondasi · Lingkungan demo, data fiktif
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
