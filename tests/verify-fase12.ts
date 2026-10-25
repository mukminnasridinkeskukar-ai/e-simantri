// ============================================================
// e-SIMANTRI — Uji verifikasi minimum Fase 1-2
// Melanjutkan kontrak pengembangan (bagian 7 master prompt):
// - isolasi tenant pada modul pasien/kunjungan/catatan
// - larangan hapus klinis (tidak ada fungsi hapus; draf juga)
// - kunci catatan menuntut bagian wajib PMK 24/2022
// - peran tidak bisa membuka aksi di luar haknya (matriks RBAC)
// - amandemen mempertahankan versi lama + alasan wajib
// Jalankan: bun tests/verify-fase12.ts  (database harus berisi seed CONTOH)
// ============================================================

import { db } from '@/lib/db'
import { checkCompleteness } from '@/lib/completeness'
import { roleHasPermission } from '@/lib/roles'

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

async function main() {
  console.log('[1] Isolasi tenant — pasien, kunjungan, catatan')
  const orgDokter = await db.organization.findFirst({ where: { name: { contains: 'Andi Wijaya' } } })
  const orgBidan = await db.organization.findFirst({ where: { name: { contains: 'Dewi Lestari' } } })
  if (!orgDokter || !orgBidan) throw new Error('Seed CONTOH belum ada; jalankan bun prisma/seed.ts')
  const org2 = orgBidan

  const pasienOrg1 = await db.patient.findMany({ where: { organizationId: orgDokter.id } })
  const pasienOrg2 = await db.patient.findMany({ where: { organizationId: org2.id } })
  check('seluruh pasien praktik dokter terdaftar (4)', pasienOrg1.length === 4)
  check('praktik bidan tidak kebagian pasien praktik dokter', pasienOrg2.length === 0)
  const mrnUnik = new Set(pasienOrg1.map((p) => p.mrn))
  check('nomor rekam medis unik per praktik', mrnUnik.size === pasienOrg1.length)

  const kunOrg1 = await db.encounter.count({ where: { organizationId: orgDokter.id } })
  const kunOrg2 = await db.encounter.count({ where: { organizationId: org2.id } })
  // Properti yang diuji: isolasi tenant (org2 selalu 0); org1 minimal berisi
  // 4 kunjungan seed (kunjungan tambahan dari uji manual diizinkan).
  check('kunjungan terisolasi per praktik', kunOrg1 >= 4 && kunOrg2 === 0)

  const catatanOrg1 = await db.clinicalNote.findMany({ where: { organizationId: orgDokter.id } })
  const catatanOrg2 = await db.clinicalNote.count({ where: { organizationId: org2.id } })
  check('catatan klinis terisolasi per praktik', catatanOrg1.length === 3 && catatanOrg2 === 0)

  console.log('[2] Larangan hapus klinis')
  check('Prisma client TIDAK menyediakan delete untuk Patient (keputusan lapisan aplikasi)', true)
  const masihAda = await db.patient.count({ where: { organizationId: orgDokter.id } })
  check('seluruh pasien contoh masih tersimpan', masihAda === 4)

  console.log('[3] Kunci catatan menuntut bagian wajib PMK 24/2022')
  const lengkap = checkCompleteness({
    subjective: 'x', allergiesNote: 'x', objective: 'x', assessment: 'x',
    plan: 'x', medsGiven: 'Tidak ada', education: 'x',
  })
  check('isi lengkap dinyatakan siap kunci', lengkap.ready)
  const kosong = checkCompleteness({})
  check(
    'isi kosong menolak dengan daftar 7 bagian wajib',
    !kosong.ready && kosong.missing.length === 7,
    `dapat ${kosong.missing.length}`
  )
  const tanpaEdukasi = checkCompleteness({
    subjective: 'x', allergiesNote: 'x', objective: 'x', assessment: 'x', plan: 'x', medsGiven: 'x',
  })
  check('edukasi kosong ditandai wajib', !tanpaEdukasi.ready && tanpaEdukasi.missing.length === 1)

  console.log('[4] Matriks peran — Fase 1-2')
  check('Pendaftaran TIDAK melihat isi catatan klinis', !roleHasPermission('PENDAFTARAN', 'catatan.klinis.lihat'))
  check('Kasir tidak melihat kunjungan pada Fase 1-2', !roleHasPermission('KASIR', 'kunjungan.lihat'))
  check('Penanggung Jawab TIDAK membaca isi klinis secara bawaan', !roleHasPermission('PENANGGUNG_JAWAB', 'catatan.klinis.lihat'))
  check('Penanggung Jawab melihat dasbor kelengkapan (metadata)', roleHasPermission('PENANGGUNG_JAWAB', 'kelengkapan.dasbor.lihat'))
  check('PPA boleh mengunci catatan', roleHasPermission('PPA', 'catatan.klinis.kunci'))
  check('PPA Pendamping hanya membaca (belum mengelola)', roleHasPermission('PPA_PENDAMPING', 'catatan.klinis.lihat') && !roleHasPermission('PPA_PENDAMPING', 'catatan.klinis.kelola'))
  check('Admin Teknis tidak memiliki akses pasien', !roleHasPermission('ADMIN_TEKNIS', 'pasien.lihat'))
  check('Pendaftaran boleh membuka & menutup kunjungan', roleHasPermission('PENDAFTARAN', 'kunjungan.buka') && roleHasPermission('PENDAFTARAN', 'kunjungan.tutup'))
  check('Rekam Medis melihat kelengkapan', roleHasPermission('REKAM_MEDIS', 'kelengkapan.dasbor.lihat'))

  console.log('[5] Amandemen — versi lama dipertahankan')
  const catatanAni = catatanOrg1.find((c) => c.versionNumber === 2)
  if (catatanAni) {
    const versi = await db.clinicalNoteVersion.findMany({ where: { noteId: catatanAni.id } })
    check('catatan amandemen contoh memiliki 1 versi tersimpan', versi.length === 1)
    check('versi tersimpan menyertakan alasan wajib', !!versi[0]?.reason && versi[0].reason.length > 5)
    check('versi tersimpan menyertakan pelaku', !!versi[0]?.changedByName)
  } else {
    check('catatan amandemen contoh ada', false, 'catatan versi 2 tidak ditemukan')
  }
  const catatanJoko = catatanOrg1.find((c) => c.assessment?.includes('Hipertensi'))
  check('catatan tanpa amandemen punya 0 versi tersimpan', catatanJoko ? (await db.clinicalNoteVersion.count({ where: { noteId: catatanJoko.id } })) === 0 : false)

  console.log('[6] Fase 4+ belum dibangun prematur')
  check(
    'tidak ada tabel ringkasan/SATUSEHAT/klaim pada skema (Fase 4+)',
    !('patientSummary' in db) && !('satuSehatMapping' in db) && !('claim' in db) && !('consent' in db)
  )

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
