'use client'

// ============================================================
// e-SIMANTRI — Peramban Terminologi (Fase 3)
// Menelusuri katalog referensi global: ICD-10, ICD-9-CM, KFA.
// Baca-saja — katalog tidak dapat diubah dari aplikasi.
// Katalog pada lingkungan contoh adalah SUBSET CONTOH; produksi
// mengimpor katalog resmi Kemenkes.
// ============================================================

import { useState } from 'react'
import { BookOpen, Loader2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { searchIcd10Action, searchIcd9CmAction, searchKfaAction } from '@/server/terminology'
import type { Icd10OptionDTO, Icd9CmOptionDTO, KfaOptionDTO } from '@/lib/dto'

export function TerminologiView() {
  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-lg font-semibold sm:text-xl">Terminologi</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Katalog referensi global untuk kodifikasi diagnosis (ICD-10), tindakan (ICD-9-CM), dan
          obat/alkes (KFA). Katalog bersifat baca-saja dan dipakai bersama seluruh praktik pada
          instalasi ini.
        </p>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" /> Telusuri katalog
          </CardTitle>
          <CardDescription>
            Subset CONTOH untuk mencoba alur — bukan katalog resmi lengkap. Produksi wajib
            mengimpor katalog Kemenkes (ICD-10, ICD-9-CM, KFA) sebelum dipakai nyata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="icd10">
            <TabsList className="flex-wrap">
              <TabsTrigger value="icd10">ICD-10 · Diagnosis</TabsTrigger>
              <TabsTrigger value="icd9cm">ICD-9-CM · Tindakan</TabsTrigger>
              <TabsTrigger value="kfa">KFA · Obat &amp; Alkes</TabsTrigger>
            </TabsList>
            <TabsContent value="icd10">
              <CatalogSearch<Icd10OptionDTO>
                placeholder="Cari kode atau nama diagnosis (mis. hipertensi, J06)…"
                onSearch={searchIcd10Action}
                columns={['Kode', 'Judul', 'Bab']}
                renderRow={(r) => (
                  <>
                    <span className="font-mono font-semibold">{r.code}</span>
                    <span>{r.description}</span>
                    <span className="text-muted-foreground">{r.chapter ?? '—'}</span>
                  </>
                )}
              />
            </TabsContent>
            <TabsContent value="icd9cm">
              <CatalogSearch<Icd9CmOptionDTO>
                placeholder="Cari kode atau nama tindakan (mis. injeksi, 99.21)…"
                onSearch={searchIcd9CmAction}
                columns={['Kode', 'Judul', 'Bab']}
                renderRow={(r) => (
                  <>
                    <span className="font-mono font-semibold">{r.code}</span>
                    <span>{r.description}</span>
                    <span className="text-muted-foreground">{r.chapter ?? '—'}</span>
                  </>
                )}
              />
            </TabsContent>
            <TabsContent value="kfa">
              <CatalogSearch<KfaOptionDTO>
                placeholder="Cari nama obat, sediaan, atau kode (mis. paracetamol, tablet)…"
                onSearch={searchKfaAction}
                columns={['Kode KFA', 'Nama', 'Sediaan']}
                renderRow={(r) => (
                  <>
                    <span className="font-mono font-semibold">{r.code}</span>
                    <span>
                      {r.name}
                      {r.strength ? ` ${r.strength}` : ''}
                    </span>
                    <span className="text-muted-foreground">
                      {[r.dosageForm, r.unit].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </>
                )}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function CatalogSearch<T extends { id: string }>({
  placeholder,
  onSearch,
  renderRow,
  columns,
}: {
  placeholder: string
  onSearch: (q: string) => Promise<T[] | null>
  renderRow: (row: T) => React.ReactNode
  columns: string[]
}) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<T[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)

  async function run(q: string) {
    setBusy(true)
    try {
      const res = await onSearch(q)
      setRows(res ?? [])
      setSearched(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim()) run(query)
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="min-h-11 pl-9"
            aria-label="Kata kunci pencarian katalog"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={busy || !query.trim()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Cari
        </button>
      </form>

      {rows === null ? (
        <p className="text-sm text-muted-foreground">
          Masukkan kata kunci lalu tekan Cari — maksimal 15 hasil teratas.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {searched ? 'Tidak ada hasil pada subset katalog contoh.' : ''}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[110px_1fr_90px] gap-2 border-b bg-muted/50 px-3 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <span key={c} className="font-medium">
                {c}
              </span>
            ))}
          </div>
          <ul>
            {rows.map((r, i) => (
              <li
                key={r.id}
                className={`grid grid-cols-[110px_1fr_90px] items-start gap-2 px-3 py-2 text-sm ${
                  i < rows.length - 1 ? 'border-b' : ''
                }`}
              >
                {renderRow(r)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        <Badge variant="secondary" className="mr-1.5 text-[10px]">
          Subset CONTOH
        </Badge>
        Pencarian katalog tidak tercatat sebagai akses isi klinis — katalog adalah referensi
        bersama, bukan data pasien.
      </p>
    </div>
  )
}
