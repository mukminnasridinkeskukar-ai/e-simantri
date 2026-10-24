'use client'

// ============================================================
// e-SIMANTRI — Profil tempat praktik (Fase 0)
// Lihat/ubah identitas fasilitas + kop surat.
// Hak ubah: Penanggung Jawab & Admin Teknis.
// ============================================================

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { roleHasPermission } from '@/lib/roles'
import { PRACTICE_TYPE_KEYS, PRACTICE_TYPE_LABELS } from '@/lib/roles'
import { getOrgProfileAction, updateOrgProfileAction } from '@/server/actions'
import type { AppStatus, OrganizationDTO } from '@/lib/dto'

const EMPTY: OrganizationDTO = {
  id: '',
  name: '',
  practiceType: 'PRAKTIK_DOKTER',
  sipNumber: null,
  ownerName: null,
  address: null,
  city: null,
  province: null,
  postalCode: null,
  phone: null,
  email: null,
  letterheadText: null,
  status: 'AKTIF',
  updatedAt: new Date().toISOString(),
}

export function PraktikView({ state }: { state: Extract<AppStatus, { status: 'ready' }> }) {
  const { toast } = useToast()
  const [org, setOrg] = useState<OrganizationDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const canEdit = roleHasPermission(state.context.role as never, 'praktik.profil.ubah')

  useEffect(() => {
    // Mulai dari konteks sesi agar cepat, lalu tarik profil terbaru
    setOrg(state.context.organization)
    getOrgProfileAction().then((o) => {
      if (o) setOrg(o)
    })
  }, [state.context.organization])

  if (!org) return null

  function set<K extends keyof OrganizationDTO>(key: K, value: OrganizationDTO[K]) {
    setOrg((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    setBusy(true)
    try {
      const res = await updateOrgProfileAction({
        name: org.name,
        practiceType: org.practiceType,
        sipNumber: org.sipNumber ?? undefined,
        ownerName: org.ownerName ?? undefined,
        address: org.address ?? undefined,
        city: org.city ?? undefined,
        province: org.province ?? undefined,
        postalCode: org.postalCode ?? undefined,
        phone: org.phone ?? undefined,
        email: org.email ?? undefined,
        letterheadText: org.letterheadText ?? undefined,
      })
      if (res.ok) {
        toast({ title: 'Tersimpan', description: res.message })
      } else {
        toast({ title: 'Gagal menyimpan', description: res.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-lg font-semibold sm:text-xl">Profil tempat praktik</h1>
        <p className="text-sm text-muted-foreground">
          Identitas fasilitas pelayanan kesehatan pada e-SIMANTRI. Satu organisasi mewakili satu
          tempat praktik mandiri (satu penyelenggara). Data ini menjadi dasar kop dokumen dan
          integrasi pada fase berikutnya.
        </p>
      </section>

      <form onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identitas fasilitas</CardTitle>
            <CardDescription>
              Nama resmi praktik sesuai dokumen penyelenggaraan (SIP penyelenggara).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-name">Nama praktik</Label>
              <Input
                id="org-name"
                value={org.name}
                onChange={(e) => set('name', e.target.value)}
                disabled={!canEdit || busy}
                required
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis praktik</Label>
              <Select
                value={org.practiceType}
                onValueChange={(v) => set('practiceType', v)}
                disabled={!canEdit || busy}
              >
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue placeholder="Pilih jenis praktik" />
                </SelectTrigger>
                <SelectContent>
                  {PRACTICE_TYPE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PRACTICE_TYPE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-sip">SIP penyelenggara</Label>
              <Input
                id="org-sip"
                value={org.sipNumber ?? ''}
                onChange={(e) => set('sipNumber', e.target.value)}
                disabled={!canEdit || busy}
                placeholder="Mis. 445/1/CONTOH/2026"
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-owner">Nama penanggung jawab</Label>
              <Input
                id="org-owner"
                value={org.ownerName ?? ''}
                onChange={(e) => set('ownerName', e.target.value)}
                disabled={!canEdit || busy}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-status">Status penyelenggaraan</Label>
              <Input
                value={org.status === 'AKTIF' ? 'Aktif' : 'Tidak aktif (arsip)'}
                disabled
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">
                Praktik yang tutup tetap menjaga retensi isi rekam medis; penonaktifan lewat
                prosedur serah terima (fase lanjutan).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alamat & kontak</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-address">Alamat</Label>
              <Input
                id="org-address"
                value={org.address ?? ''}
                onChange={(e) => set('address', e.target.value)}
                disabled={!canEdit || busy}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-city">Kota/Kabupaten</Label>
              <Input
                id="org-city"
                value={org.city ?? ''}
                onChange={(e) => set('city', e.target.value)}
                disabled={!canEdit || busy}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-province">Provinsi</Label>
              <Input
                id="org-province"
                value={org.province ?? ''}
                onChange={(e) => set('province', e.target.value)}
                disabled={!canEdit || busy}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-postal">Kode pos</Label>
              <Input
                id="org-postal"
                value={org.postalCode ?? ''}
                onChange={(e) => set('postalCode', e.target.value)}
                disabled={!canEdit || busy}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Telepon</Label>
              <Input
                id="org-phone"
                value={org.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
                disabled={!canEdit || busy}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-email">Email fasilitas</Label>
              <Input
                id="org-email"
                type="email"
                value={org.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
                disabled={!canEdit || busy}
                className="min-h-11"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kop surat / kop dokumen</CardTitle>
            <CardDescription>
              Dipakai pada salinan isi rekam medis dan resume kunjungan (mulai Fase 4). Tulis
              teks kop yang sesuai identitas fasilitas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={org.letterheadText ?? ''}
              onChange={(e) => set('letterheadText', e.target.value)}
              disabled={!canEdit || busy}
              rows={3}
              placeholder="Mis. PRAKTIK DOKTER ... — Alamat lengkap — Telepon — Email"
            />
          </CardContent>
          {canEdit && (
            <CardFooter className="justify-end gap-2">
              <Button type="submit" disabled={busy} className="min-h-11">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan profil
              </Button>
            </CardFooter>
          )}
        </Card>

        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Peran Anda hanya dapat melihat profil. Perubahan dilakukan oleh Penanggung Jawab
            Praktik atau Admin Teknis dan seluruhnya tercatat pada jejak audit.
          </p>
        )}
      </form>
    </div>
  )
}
