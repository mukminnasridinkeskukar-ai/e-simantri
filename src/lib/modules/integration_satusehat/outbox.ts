// ============================================================
// MODUL: integration_satusehat — antrean outbox (Fase 5)
//
// Pola outbox: alur klinis HANYA memasukkan kejadian ke antrean saat
// kunjungan dikunci. Pengiriman dilakukan pekerja terpisah:
// - Mode SIMULASI: tidak menghubungi server mana pun; menandai TERKIRIM
//   dengan ID sumber daya contoh, jelas ditandai di UI.
// - Mode SANDBOX: mengirim ke baseUrl yang dikonfigurasi praktik
//   (endpoint sandbox). Gagal tidak pernah menghapus data lokal.
// Setiap percobaan tercatat pada FhirSyncLog dan jejak audit.
// ============================================================

import { createHash, randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { tulisAudit } from '@/lib/modules/audit/logger'
import { templateUntukProfesi, type IsiDokumen } from '@/lib/modules/clinical_document/templates'
import {
  mapPatient,
  mapEncounter,
  mapCondition,
  mapObservations,
  mapProcedure,
  mapMedicationRequest,
  mapComposition,
  type DataKunjungan,
} from './mapper'

/// Dipanggil saat kunjungan DIKUNCI: memetakan seluruh sumber daya FHIR
/// untuk kunjungan ini dan memasukkannya sebagai kejadian antrean.
export async function masukkanAntreanKunjungan(encounterId: string, organizationId: string): Promise<number> {
  const kunjungan = await db.encounter.findFirst({
    where: { id: encounterId, organizationId, status: 'DIKUNCI' },
    include: {
      patient: true,
      organization: true,
      diagnoses: true,
      procedures: true,
      prescriptions: { where: { status: { not: 'DIBATALKAN' } }, include: { items: true } },
      documents: { where: { isCurrent: true } },
    },
  })
  if (!kunjungan) return 0

  // Antrean hanya dibuat bila integrasi diaktifkan untuk praktik ini.
  const config = await db.satusehatConfig.findUnique({ where: { organizationId } })
  if (!config || !config.enabled) return 0

  // Cegah antrean ganda bila kunci dibuka lalu dikunci kembali.
  const sudahAda = await db.outboxEvent.count({ where: { encounterId: kunjungan.id, status: { in: ['ANTRE', 'TERKIRIM'] } } })
  if (sudahAda > 0) return 0

  const docKlinis = kunjungan.documents.find((d) => d.type === 'CATATAN_PEMERIKSAAN' && d.isCurrent)
  const isi: IsiDokumen | null = docKlinis ? (JSON.parse(docKlinis.content) as IsiDokumen) : null

  const data: DataKunjungan = {
    encounter: {
      id: kunjungan.id,
      encounterNumber: kunjungan.encounterNumber,
      type: kunjungan.type,
      status: kunjungan.status,
      registeredAt: kunjungan.registeredAt,
      startedAt: kunjungan.startedAt,
      finishedAt: kunjungan.finishedAt,
      lockedAt: kunjungan.lockedAt,
      chiefComplaint: kunjungan.chiefComplaint,
      telemedicineNote: kunjungan.telemedicineNote,
    },
    patient: {
      id: kunjungan.patient.id,
      medicalRecordNumber: kunjungan.patient.medicalRecordNumber,
      nik: kunjungan.patient.nik,
      ihsNumber: kunjungan.patient.ihsNumber,
      name: kunjungan.patient.name,
      dateOfBirth: kunjungan.patient.dateOfBirth,
      sex: kunjungan.patient.sex,
      phone: kunjungan.patient.phone,
      address: kunjungan.patient.address,
    },
    diagnoses: kunjungan.diagnoses.map((d) => ({ id: d.id, icd10Code: d.icd10Code, display: d.display, kind: d.kind })),
    procedures: kunjungan.procedures.map((t) => ({
      id: t.id,
      name: t.name,
      icd9cmCode: t.icd9cmCode,
      performedAt: t.performedAt,
    })),
    prescriptions: kunjungan.prescriptions.map((r) => ({
      id: r.id,
      prescriptionNumber: r.prescriptionNumber,
      items: r.items.map((i) => ({
        id: i.id,
        drugName: i.drugName,
        strength: i.strength,
        form: i.form,
        quantity: i.quantity,
        usage: i.usage,
        kfaCode: i.kfaCode,
      })),
    })),
    tandaVital: isi?.tanda_vital ?? null,
    anamnesisKeluhan: isi?.anamnesis?.keluhan_utama ?? null,
    rencanaTatalaksana: isi?.rencana?.tatalaksana ?? null,
    edukasi: isi?.rencana?.edukasi ?? null,
  }

  const konteks = {
    organization: { id: kunjungan.organizationId, name: kunjungan.organization.name, isSample: kunjungan.organization.isSample },
    satusehatOrgRef: config.locationRefId,
  }

  const kejadian: Array<{ eventType: string; aggregateRef: string; payload: unknown }> = []
  kejadian.push({ eventType: 'PATIENT', aggregateRef: kunjungan.patient.id, payload: mapPatient(data.patient, konteks) })
  kejadian.push({ eventType: 'ENCOUNTER', aggregateRef: kunjungan.id, payload: mapEncounter(data.encounter, data.patient, konteks) })
  for (const d of data.diagnoses) {
    try {
      kejadian.push({ eventType: 'CONDITION', aggregateRef: d.id, payload: mapCondition(d, data.patient, data.encounter, konteks) })
    } catch (err) {
      // Diagnosa tanpa kode → masuk antrean dengan status GAGAL_VALIDASI (tidak diam-diam).
      await db.outboxEvent.create({
        data: {
          organizationId,
          encounterId: kunjungan.id,
          eventType: 'CONDITION',
          aggregateRef: d.id,
          payload: JSON.stringify({ display: d.display, kind: d.kind, alasan: 'tanpa kode ICD-10' }),
          status: 'GAGAL_VALIDASI',
          lastError: err instanceof Error ? err.message : 'Validasi gagal',
        },
      })
    }
  }
  if (data.tandaVital) {
    kejadian.push({
      eventType: 'OBSERVATION',
      aggregateRef: `${kunjungan.id}:vital`,
      payload: mapObservations(data.tandaVital, data.patient, data.encounter, konteks),
    })
  }
  for (const t of data.procedures) {
    kejadian.push({ eventType: 'PROCEDURE', aggregateRef: t.id, payload: mapProcedure(t, data.patient, data.encounter, konteks) })
  }
  for (const r of data.prescriptions) {
    kejadian.push({
      eventType: 'MEDICATIONREQUEST',
      aggregateRef: r.id,
      payload: mapMedicationRequest(r, data.patient, data.encounter, konteks),
    })
  }
  kejadian.push({ eventType: 'COMPOSITION', aggregateRef: kunjungan.id, payload: mapComposition(data, konteks) })

  await db.outboxEvent.createMany({
    data: kejadian.map((k) => ({
      organizationId,
      encounterId: kunjungan.id,
      eventType: k.eventType,
      aggregateRef: k.aggregateRef,
      payload: JSON.stringify(k.payload),
    })),
  })

  await db.satusehatConfig.update({ where: { organizationId }, data: { lastProcessedAt: new Date() } }).catch(() => undefined)
  return kejadian.length
}

function hashContoh(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

/// Pekerja antrean: dipanggil tombol UI / cron. Bila mode SIMULASI,
/// tidak ada trafik keluar. Bila SANDBOX, kirim POST per sumber daya.
export async function prosesAntrean(organizationId: string, actorLabel: string): Promise<{ diproses: number; berhasil: number; gagal: number }> {
  const config = await db.satusehatConfig.findUnique({ where: { organizationId } })
  if (!config || !config.enabled) return { diproses: 0, berhasil: 0, gagal: 0 }

  const antre = await db.outboxEvent.findMany({
    where: { organizationId, status: { in: ['ANTRE', 'GAGAL_KIRIM'] } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  let berhasil = 0
  let gagal = 0

  for (const kejadian of antre) {
    let sumber: Array<Record<string, unknown>>
    try {
      sumber = JSON.parse(kejadian.payload) as Array<Record<string, unknown>>
    } catch {
      sumber = [JSON.parse(kejadian.payload) as Record<string, unknown>]
    }

    const percobaan = kejadian.attempts + 1
    let statusBaru = 'TERKIRIM'
    let kesalahan: string | null = null
    let tipe: string | null = null
    let idSumber: string | null = null

    try {
      const payloads = (Array.isArray(sumber) ? sumber : [sumber]).filter(
        (p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object'
      )
      if (payloads.length === 0) throw new Error('Payload kosong')

      for (const payload of payloads) {
        tipe = String(payload.resourceType ?? kejadian.eventType)
        // Validasi paling dasar: resourceType & (untuk kode) kode tidak boleh kosong.
        if (!tipe) throw new Error('resourceType tidak ada')
        const code = payload.code as { coding?: Array<{ code?: string }> } | undefined
        if (code && code.coding && code.coding.length > 0 && !code.coding.every((c) => c.code)) {
          throw new Error('Kode terminologi kosong — mapper menolak mengirim tanpa kode')
        }

        if (config.mode === 'SANDBOX' && config.baseUrl) {
          const resp = await kirimKeSandbox(config, payload)
          idSumber = resp.id ?? idSumber
        } else {
          // SIMULASI: ID contoh yang jelas-jelas bukan ID produksi.
          idSumber = `CONTOH-${tipe}-${hashContoh(String(payload.id ?? randomUUID()))}`
        }
      }
      berhasil += 1
    } catch (err) {
      statusBaru = 'GAGAL_KIRIM'
      kesalahan = err instanceof Error ? err.message : 'Kegagalan tidak diketahui'
      gagal += 1
    }

    await db.outboxEvent.update({
      where: { id: kejadian.id },
      data: {
        status: statusBaru,
        attempts: percobaan,
        lastError: kesalahan,
        fhirResourceType: tipe,
        fhirResourceId: statusBaru === 'TERKIRIM' ? idSumber : null,
        sentAt: statusBaru === 'TERKIRIM' ? new Date() : null,
      },
    })

    await db.fhirSyncLog.create({
      data: {
        organizationId,
        outboxEventId: kejadian.id,
        attempt: percobaan,
        outcome: statusBaru === 'TERKIRIM' ? (config.mode === 'SIMULASI' ? 'SIMULASI' : 'BERHASIL') : 'GAGAL_KIRIM',
        message: kesalahan ?? (config.mode === 'SIMULASI' ? 'Teririm dalam mode SIMULASI (ID contoh)' : 'Terkirim ke sandbox'),
      },
    })
  }

  await tulisAudit({
    organizationId,
    action: 'OUTBOX_PROSES',
    objectType: 'OutboxEvent',
    userLabel: actorLabel,
    summary: `Antrean SATUSEHAT diproses: ${berhasil} berhasil, ${gagal} gagal (mode ${config.mode})`,
  })

  // Perbarui status kunjungan: TERKIRIM bila seluruh kejadian inti selesai.
  const kunjunganTerkait = [...new Set(antre.map((k) => k.encounterId))]
  for (const encId of kunjunganTerkait) {
    const sisa = await db.outboxEvent.count({
      where: { encounterId: encId, status: { in: ['ANTRE', 'GAGAL_KIRIM'] } },
    })
    const gagalValidasi = await db.outboxEvent.count({
      where: { encounterId: encId, status: 'GAGAL_VALIDASI' },
    })
    await db.encounter.update({
      where: { id: encId },
      data: { status: sisa === 0 ? 'TERKIRIM' : 'GAGAL_KIRIM' },
    }).catch(() => undefined)
    if (gagalValidasi > 0 && sisa === 0) {
      // Validasi gagal tetap membuat kunjungan berstatus GAGAL_KIRIM agar tidak luput.
      await db.encounter.update({ where: { id: encId }, data: { status: 'GAGAL_KIRIM' } }).catch(() => undefined)
    }
  }

  return { diproses: antre.length, berhasil, gagal }
}

interface ConfigKirim {
  baseUrl: string
  clientId?: string | null
  clientSecret?: string | null
}

async function kirimKeSandbox(config: ConfigKirim, payload: Record<string, unknown>): Promise<{ id?: string }> {
  // Token sandbox (client credentials). Kegagalan auth = GAGAL_KIRIM.
  const base = config.baseUrl.replace(/\/+$/, '')
  let token: string | null = null
  if (config.clientId && config.clientSecret) {
    const resp = await fetch(`${base}/oauth2/v1/accesstoken?grant_type=client_credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret }),
    })
    if (!resp.ok) throw new Error(`Autentikasi sandbox gagal (HTTP ${resp.status})`)
    const isi = (await resp.json()) as { access_token?: string }
    token = isi.access_token ?? null
  }

  const resourceType = String(payload.resourceType ?? 'Unknown')
  const id = typeof payload.id === 'string' ? payload.id.split('/').pop() : undefined
  const url = `${base}/fhir-r4/v1/${resourceType}${id ? `/${id}` : ''}`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) {
    throw new Error(`Kirim ${resourceType} gagal (HTTP ${resp.status})`)
  }
  const hasil = (await resp.json().catch(() => ({}))) as { id?: string }
  return { id: hasil.id }
}
