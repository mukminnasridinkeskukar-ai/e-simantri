// ============================================================
// e-SIMANTRI — Uji verifikasi minimum Fase 3
// Melanjutkan kontrak pengembangan (bagian 7 master prompt):
// - katalog referensi global tersedia & konsisten (subset CONTOH)
// - kodifikasi beku saat catatan terkunci (lockedAt)
// - koreksi terkunci hanya lewat amandemen (supersededAt +
//   snapshot kode pada versi — append-only, tanpa hapus)
// - resep bernomor per praktik, dibatalkan beralasan, tanpa hapus
// - peran tidak bisa mengakses di luar haknya (matriks RBAC)
// - modul Fase 4+ tidak dibangun prematur
// Jalankan: bun tests/verify-fase3.ts  (database harus berisi seed CONTOH)
// ============================================================

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { roleHasPermission, auditActionLabel } from '@/lib/roles'

let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function modelFieldExists(model: string, field: string): boolean {
  const dmmf = Prisma.dmmf.datamodel as unknown as {
    models: { name: string; fields: { name: string }[] }[]
  }
  const m = dmmf.models.find((x) => x.name === model)
  return !!m && m.fields.some((f) => f.name === field)
}

async function main() {
  const orgDokter = await db.organization.findFirst({ where: { name: { contains: 'Andi Wijaya' } } })
  const orgBidan = await db.organization.findFirst({ where: { name: { contains: 'Dewi Lestari' } } })
  if (!orgDokter || !orgBidan) throw new Error('Seed CONTOH belum ada; jalankan bun prisma/seed.ts')

  console.log('[1] Katalog referensi global — subset CONTOH')
  const icd10 = await db.icd10Code.findMany()
  const icd9 = await db.icd9CmCode.findMany()
  const kfa = await db.kfaCode.findMany()
  check('katalog ICD-10 subset tersedia (>= 40 kode)', icd10.length >= 40, `dapat ${icd10.length}`)
  check('katalog ICD-9-CM subset tersedia (>= 10 kode)', icd9.length >= 10, `dapat ${icd9.length}`)
  check('katalog KFA subset tersedia (>= 20 obat)', kfa.length >= 20, `dapat ${kfa.length}`)
  check('kode ICD-10 unik', new Set(icd10.map((c) => c.code)).size === icd10.length)
  check('kode ICD-9-CM unik', new Set(icd9.map((c) => c.code)).size === icd9.length)
  check('kode KFA unik', new Set(kfa.map((c) => c.code)).size === kfa.length)
  check('seluruh katalog ditandai subset demo (isSeedDemo)', [...icd10, ...icd9, ...kfa].every((c) => c.isSeedDemo))
  check('katalog global: tidak terikat tenant (organizationId tidak ada pada skema katalog)',
    !modelFieldExists('Icd10Code', 'organizationId') && !modelFieldExists('KfaCode', 'organizationId'))

  console.log('[2] Kodifikasi pada catatan — beku saat terkunci')
  const catatanJoko = await db.clinicalNote.findFirst({
    where: { organizationId: orgDokter.id, status: 'TERKUNCI', assessment: { contains: 'Hipertensi' } },
  })
  const catatanAni = await db.clinicalNote.findFirst({
    where: { organizationId: orgDokter.id, status: 'TERKUNCI', assessment: { contains: 'Infeksi saluran kemih' } },
  })
  const catatanDraf = await db.clinicalNote.findFirst({
    where: { organizationId: orgDokter.id, status: 'DRAF' },
  })
  if (!catatanJoko || !catatanAni || !catatanDraf) throw new Error('Catatan CONTOH tidak lengkap')

  const dxJoko = await db.noteDiagnosis.findFirst({
    where: { noteId: catatanJoko.id, supersededAt: null },
    include: { icd10: true },
  })
  check('catatan terkunci Joko berkodifikasi I10 (utama)', !!dxJoko && dxJoko.icd10.code === 'I10' && dxJoko.isPrimary)
  check('kode pada catatan terkunci BEKU (lockedAt terisi)', !!dxJoko && !!dxJoko.lockedAt)

  const dxAni = await db.noteDiagnosis.findFirst({
    where: { noteId: catatanAni.id, supersededAt: null },
    include: { icd10: true },
  })
  check('catatan terkunci Ani berkodifikasi N39.0', !!dxAni && dxAni.icd10.code === 'N39.0')

  const dxDraf = await db.noteDiagnosis.findFirst({ where: { noteId: catatanDraf.id } })
  check('draf boleh memuat kode belum beku (lockedAt kosong)', !!dxDraf && !dxDraf.lockedAt)

  const dxBidan = await db.noteDiagnosis.count({ where: { organizationId: orgBidan.id } })
  check('kodifikasi terisolasi per praktik (praktik bidan 0)', dxBidan === 0)

  console.log('[3] Jalur koreksi append-only (supersededAt + snapshot versi)')
  check('skema NoteDiagnosis menyediakan supersededAt (koreksi tanpa hapus)', modelFieldExists('NoteDiagnosis', 'supersededAt'))
  check('skema NoteProcedure menyediakan supersededAt', modelFieldExists('NoteProcedure', 'supersededAt'))
  check('versi catatan menyimpan snapshot kodifikasi (codesSnapshot)', modelFieldExists('ClinicalNoteVersion', 'codesSnapshot'))
  const totalDx = await db.noteDiagnosis.count({ where: { noteId: catatanJoko.id } })
  check('baris kodifikasi tidak pernah dihapus (jumlah aktif = total)', totalDx === 1)

  console.log('[4] Resep terstruktur — bernomor, terisolasi, tanpa hapus')
  const rxs = await db.prescription.findMany({
    where: { organizationId: orgDokter.id },
    include: { items: { include: { kfaCode: true } } },
  })
  check('2 resep CONTOH tersedia', rxs.length === 2, `dapat ${rxs.length}`)
  const numbers = rxs.map((r) => r.number).sort()
  check('nomor resep berformat RESEP-xxxx', numbers.every((n) => /^RESEP-\d{4}$/.test(n)), numbers.join(', '))
  check('nomor resep unik per praktik', new Set(numbers).size === numbers.length)
  check('seluruh item resep berkodifikasi KFA katalog', rxs.every((r) => r.items.every((it) => !!it.kfaCode.code)))
  check('snapshot nama obat tersimpan pada item (tidak bergantung katalog)', rxs.every((r) => r.items.every((it) => it.drugName.length > 0)))
  check('item resep memiliki jalur pemberian (route)', rxs.every((r) => r.items.every((it) => it.route.length > 0)))
  const rxBidan = await db.prescription.count({ where: { organizationId: orgBidan.id } })
  check('resep terisolasi per praktik (praktik bidan 0)', rxBidan === 0)
  const org1 = await db.organization.findUniqueOrThrow({ where: { id: orgDokter.id } })
  check('penghitung resep praktik konsisten (rxCounter = jumlah resep)', org1.rxCounter === rxs.length, `rxCounter=${org1.rxCounter}`)
  check('status resep hanya AKTIF/DIBATALKAN (bukan hapus)', rxs.every((r) => r.status === 'AKTIF' || r.status === 'DIBATALKAN'))

  console.log('[5] Matriks peran — Fase 3')
  check('PPA boleh mencari katalog & mengelola kodifikasi', roleHasPermission('PPA', 'terminologi.cari') && roleHasPermission('PPA', 'kodifikasi.kelola'))
  check('Penanggung Jawab TIDAK mencari/mengelola kode (isi klinis)', !roleHasPermission('PENANGGUNG_JAWAB', 'terminologi.cari') && !roleHasPermission('PENANGGUNG_JAWAB', 'kodifikasi.kelola'))
  check('PPA Pendamping hanya mencari katalog (tidak mengelola)', roleHasPermission('PPA_PENDAMPING', 'terminologi.cari') && !roleHasPermission('PPA_PENDAMPING', 'kodifikasi.kelola'))
  check('Rekam Medis mencari katalog untuk bantuan koding (bukan mengelola)', roleHasPermission('REKAM_MEDIS', 'terminologi.cari') && !roleHasPermission('REKAM_MEDIS', 'kodifikasi.kelola'))
  check('Pendaftaran tidak punya akses kodifikasi', !roleHasPermission('PENDAFTARAN', 'terminologi.cari') && !roleHasPermission('PENDAFTARAN', 'kodifikasi.kelola'))
  check('Kasir tidak punya akses kodifikasi', !roleHasPermission('KASIR', 'terminologi.cari') && !roleHasPermission('KASIR', 'kodifikasi.kelola'))
  check('Admin Teknis tidak punya akses kodifikasi', !roleHasPermission('ADMIN_TEKNIS', 'terminologi.cari') && !roleHasPermission('ADMIN_TEKNIS', 'kodifikasi.kelola'))
  check('label audit Fase 3 terdaftar', auditActionLabel('KODIFIKASI_DISEMPAN') === 'Kodifikasi catatan disimpan' && auditActionLabel('RESEP_DIBATALKAN') === 'Resep dibatalkan')

  console.log('[6] Fase 4+ belum dibangun prematur')
  const dmmf = Prisma.dmmf.datamodel as unknown as { models: { name: string }[] }
  const modelNames = dmmf.models.map((m) => m.name)
  const forbidden = ['PatientSummary', 'SummaryDocument', 'Consent', 'FhirBundle', 'SatuSehatMapping', 'Odontogram', 'Claim', 'Referral']
  check('tidak ada tabel Fase 4+ (ringkasan, consent, SATUSEHAT, odontogram, klaim, rujukan)',
    !forbidden.some((f) => modelNames.includes(f)),
    `model: ${modelNames.join(', ')}`)

  console.log(`\n=== Hasil: ${passed} lulus, ${failed} gagal ===`)
  if (failed > 0) process.exit(1)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
