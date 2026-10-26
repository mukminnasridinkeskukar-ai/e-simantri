import { db } from '@/lib/db'
import { requirePermission } from '@/lib/modules/tenant/context'
import { hasPermission, ROLE_LABELS, type Role } from '@/lib/modules/identity_access/roles'
import {
  DialogTambahPengguna,
  DialogUbahPeran,
  DialogStatusPengguna,
  DialogResetSandi,
} from '@/components/app-shell/dialog-pengguna'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Info } from 'lucide-react'

export default async function HalamanPengguna() {
  const ctx = await requirePermission('pengguna.lihat')
  const bolehKelola = hasPermission(ctx.roles, 'pengguna.kelola')

  const members = await db.membership.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, profession: true, strNumber: true, sipNumber: true, isActive: true },
      },
      roles: true,
    },
    orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Pengguna praktik</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keanggotaan dan peran pada {ctx.organizationName}. Satu akun boleh tergabung di
            lebih dari satu praktik dengan peran berbeda.
          </p>
        </div>
        {bolehKelola ? <DialogTambahPengguna /> : null}
      </div>

      {!bolehKelola ? (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            Anda dapat melihat daftar pengguna, tetapi hanya Penanggung Jawab Praktik yang
            dapat menambah pengguna, mengubah peran, atau mengubah status.
          </CardContent>
        </Card>
      ) : null}

      {/* Tabel untuk layar lebar */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle className="text-base">Daftar keanggotaan</CardTitle>
          <CardDescription>
            {members.filter((m) => m.status === 'AKTIF').length} aktif dari {members.length} keanggotaan
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto scroll-halus">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama & surel</TableHead>
                <TableHead>Profesi & nomor izin</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Status</TableHead>
                {bolehKelola ? <TableHead className="text-right">Tindakan</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const peran = m.roles.map((r) => r.role as Role)
                const peranSendiri = m.id === ctx.membershipId
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium leading-tight">
                        {m.user.fullName}
                        {peranSendiri ? <Badge variant="outline" className="ml-2">Anda</Badge> : null}
                      </p>
                      <p className="text-sm text-muted-foreground">{m.user.email}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm leading-tight">{m.user.profession ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.user.strNumber ? `STR: ${m.user.strNumber}` : null}
                        {m.user.strNumber && m.user.sipNumber ? ' · ' : null}
                        {m.user.sipNumber ? `SIP: ${m.user.sipNumber}` : null}
                        {!m.user.strNumber && !m.user.sipNumber ? 'Tanpa STR/SIP tercatat' : null}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {peran.map((r) => (
                          <Badge key={r} variant="secondary">{ROLE_LABELS[r]}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.status === 'AKTIF' ? (
                        <Badge>Aktif</Badge>
                      ) : (
                        <Badge variant="outline">Nonaktif</Badge>
                      )}
                    </TableCell>
                    {bolehKelola ? (
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <DialogUbahPeran
                            membershipId={m.id}
                            nama={m.user.fullName}
                            peranSaatIni={peran}
                            peranSendiri={peranSendiri}
                          />
                          <DialogResetSandi membershipId={m.id} nama={m.user.fullName} />
                          <DialogStatusPengguna
                            membershipId={m.id}
                            nama={m.user.fullName}
                            statusSaatIni={m.status}
                            peranSendiri={peranSendiri}
                          />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Kartu untuk layar sempit (tablet ±390 px) */}
      <div className="md:hidden space-y-3">
        {members.map((m) => {
          const peran = m.roles.map((r) => r.role as Role)
          const peranSendiri = m.id === ctx.membershipId
          return (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  {m.user.fullName}
                  {peranSendiri ? <Badge variant="outline">Anda</Badge> : null}
                  {m.status === 'AKTIF' ? <Badge>Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                </CardTitle>
                <CardDescription>{m.user.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{m.user.profession ?? 'Profesi tidak tercatat'}</p>
                <p className="text-xs text-muted-foreground">
                  {m.user.strNumber ? `STR: ${m.user.strNumber}` : null}
                  {m.user.strNumber && m.user.sipNumber ? ' · ' : null}
                  {m.user.sipNumber ? `SIP: ${m.user.sipNumber}` : null}
                  {!m.user.strNumber && !m.user.sipNumber ? 'Tanpa STR/SIP tercatat' : null}
                </p>
                <div className="flex flex-wrap gap-1">
                  {peran.map((r) => (
                    <Badge key={r} variant="secondary">{ROLE_LABELS[r]}</Badge>
                  ))}
                </div>
                {bolehKelola ? (
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <DialogUbahPeran
                      membershipId={m.id}
                      nama={m.user.fullName}
                      peranSaatIni={peran}
                      peranSendiri={peranSendiri}
                    />
                    <DialogResetSandi membershipId={m.id} nama={m.user.fullName} />
                    <DialogStatusPengguna
                      membershipId={m.id}
                      nama={m.user.fullName}
                      statusSaatIni={m.status}
                      peranSendiri={peranSendiri}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
