// Kop cetak bersama untuk dokumen salinan (resume, resep, rujukan).
// Server component — dipakai halaman /cetak/*.

export function CetakKop({
  orgName,
  alamat,
  telepon,
  isSample,
  judul,
}: {
  orgName: string
  alamat: string | null
  telepon: string | null
  isSample: boolean
  judul: string
}) {
  return (
    <div className="text-center">
      <h1 className="text-lg font-bold uppercase tracking-wide">{orgName}</h1>
      <p className="text-xs text-stone-600">{alamat ?? ''}</p>
      {telepon ? <p className="text-xs text-stone-600">Telp. {telepon}</p> : null}
      <h2 className="mt-3 inline-block border-2 border-stone-800 px-6 py-1 text-base font-bold tracking-[0.2em]">{judul}</h2>
      {isSample ? (
        <p className="mt-2 text-sm font-bold text-red-700">— DATA CONTOH / SALINAN FIKTIF —</p>
      ) : (
        <p className="mt-2 text-sm font-bold text-stone-700">SALINAN UNTUK PASIEN</p>
      )}
    </div>
  )
}
