// ============================================================
// MODUL: integration_satusehat — mapper FHIR R4 (Fase 5)
// Fungsi murni: mengubah data kunjungan terkunci menjadi payload
// FHIR R4. Tidak melakukan I/O. Aturan:
// - Waktu selalu ISO 8601 dengan zona (toISOString, UTC).
// - Condition/MedicationRequest TANPA kode tidak boleh dikirim
//   (validasi gagal → status GAGAL_VALIDASI, tidak dihapus).
// - Identifier NIK memakai system resmi SATUSEHAT; IHS bila ada.
// ============================================================

const SYSTEM_NIK = 'https://fhir.kemkes.go.id/id/nik'
const SYSTEM_RM = 'https://fhir.kemkes.go.id/id/nomor-kunang-mandiri'

export interface KonteksMapper {
  organization: { id: string; name: string; isSample: boolean }
  satusehatOrgRef?: string | null
}

export interface DataKunjungan {
  encounter: {
    id: string
    encounterNumber: string
    type: string
    status: string
    registeredAt: Date
    startedAt: Date | null
    finishedAt: Date | null
    lockedAt: Date | null
    chiefComplaint: string | null
    telemedicineNote: string | null
  }
  patient: {
    id: string
    medicalRecordNumber: string
    nik: string | null
    ihsNumber: string | null
    name: string
    dateOfBirth: Date | null
    sex: string | null
    phone: string | null
    address: string | null
  }
  diagnoses: Array<{ id: string; icd10Code: string; display: string; kind: string }>
  procedures: Array<{ id: string; name: string; icd9cmCode: string | null; performedAt: Date }>
  prescriptions: Array<{
    id: string
    prescriptionNumber: string
    items: Array<{ id: string; drugName: string; strength: string | null; form: string | null; quantity: string; usage: string; kfaCode: string | null }>
  }>
  tandaVital: Record<string, string> | null
  anamnesisKeluhan: string | null
  rencanaTatalaksana: string | null
  edukasi: string | null
}

function waktu(d: Date | null | undefined): string {
  return (d ?? new Date()).toISOString()
}

function jenisKunjunganFHIR(tipe: string): { code: string; display: string } {
  switch (tipe) {
    case 'TELEMEDISIN':
      return { code: 'VR', display: 'Virtual' }
    case 'KUNJUNGAN_RUMAH':
      return { code: 'HH', display: 'Home health' }
    case 'PERJANJIAN':
      return { code: 'AMB', display: 'Ambulatory' }
    default:
      return { code: 'AMB', display: 'Ambulatory' }
  }
}

export function mapPatient(p: DataKunjungan['patient'], konteks: KonteksMapper): Record<string, unknown> {
  const identifier: Array<Record<string, unknown>> = [
    {
      system: SYSTEM_RM,
      value: `${konteks.organization.id}:${p.medicalRecordNumber}`,
      use: 'usual',
    },
  ]
  if (p.nik) identifier.push({ system: SYSTEM_NIK, value: p.nik, use: 'official' })
  return {
    resourceType: 'Patient',
    // ID lokal stabil agar pengiriman ulang tidak membuat sumber daya baru.
    id: `Patient/${konteks.organization.id}:${p.medicalRecordNumber}`,
    identifier,
    active: true,
    name: [{ use: 'official', text: p.name }],
    gender: p.sex === 'LAKI_LAKI' ? 'male' : p.sex === 'PEREMPUAN' ? 'female' : 'unknown',
    birthDate: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : undefined,
    telecom: p.phone ? [{ system: 'phone', value: p.phone }] : undefined,
    address: p.address ? [{ text: p.address }] : undefined,
  }
}

export function mapEncounter(e: DataKunjungan['encounter'], pasien: DataKunjungan['patient'], konteks: KonteksMapper): Record<string, unknown> {
  const jenis = jenisKunjunganFHIR(e.type)
  return {
    resourceType: 'Encounter',
    id: `Encounter/${konteks.organization.id}:${e.encounterNumber}`,
    identifier: [{ system: SYSTEM_RM, value: `${konteks.organization.id}:${e.encounterNumber}` }],
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: jenis.code, display: jenis.display },
    subject: {
      reference: `Patient/${konteks.organization.id}:${pasien.medicalRecordNumber}`,
      display: pasien.name,
    },
    period: {
      start: waktu(e.startedAt ?? e.registeredAt),
      end: waktu(e.finishedAt ?? e.lockedAt),
    },
    reasonCode: e.chiefComplaint ? [{ text: e.chiefComplaint }] : undefined,
  }
}

export function mapCondition(d: DataKunjungan['diagnoses'][number], pasien: DataKunjungan['patient'], e: DataKunjungan['encounter'], konteks: KonteksMapper): Record<string, unknown> {
  if (!d.icd10Code || !d.icd10Code.trim()) {
    throw new Error('Diagnosa tanpa kode ICD-10 tidak boleh dikirim (aturan validasi mapper).')
  }
  return {
    resourceType: 'Condition',
    id: `Condition/${konteks.organization.id}:${e.encounterNumber}:${d.id}`,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: d.kind === 'UTAMA' ? 'encounter-diagnosis' : 'problem-list-item',
          },
        ],
      },
    ],
    code: {
      coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: d.icd10Code, display: d.display }],
      text: d.display,
    },
    subject: {
      reference: `Patient/${konteks.organization.id}:${pasien.medicalRecordNumber}`,
      display: pasien.name,
    },
    encounter: { reference: `Encounter/${konteks.organization.id}:${e.encounterNumber}` },
  }
}

const KODE_VITAL: Record<string, { code: string; display: string; unit: string }> = {
  td: { code: '85354-9', display: 'Blood pressure panel', unit: 'mmHg' },
  nadi: { code: '8867-4', display: 'Heart rate', unit: '/min' },
  suhu: { code: '8310-5', display: 'Body temperature', unit: 'Cel' },
  rr: { code: '9279-1', display: 'Respiratory rate', unit: '/min' },
  spo2: { code: '59408-5', display: 'Oxygen saturation', unit: '%' },
  berat: { code: '29463-7', display: 'Body weight', unit: 'kg' },
  tinggi: { code: '8302-2', display: 'Body height', unit: 'cm' },
}

export function mapObservations(tandaVital: Record<string, string>, pasien: DataKunjungan['patient'], e: DataKunjungan['encounter'], konteks: KonteksMapper): Array<Record<string, unknown>> {
  const hasil: Array<Record<string, unknown>> = []
  for (const [kunci, nilai] of Object.entries(tandaVital)) {
    const definisi = KODE_VITAL[kunci]
    if (!definisi || !String(nilai).trim()) continue
    hasil.push({
      resourceType: 'Observation',
      id: `Observation/${konteks.organization.id}:${e.encounterNumber}:${kunci}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: definisi.code, display: definisi.display }],
      },
      subject: {
        reference: `Patient/${konteks.organization.id}:${pasien.medicalRecordNumber}`,
      },
      encounter: { reference: `Encounter/${konteks.organization.id}:${e.encounterNumber}` },
      effectiveDateTime: waktu(e.finishedAt ?? e.registeredAt),
      valueString: String(nilai),
    })
  }
  return hasil
}

export function mapProcedure(t: DataKunjungan['procedures'][number], pasien: DataKunjungan['patient'], e: DataKunjungan['encounter'], konteks: KonteksMapper): Record<string, unknown> {
  return {
    resourceType: 'Procedure',
    id: `Procedure/${konteks.organization.id}:${e.encounterNumber}:${t.id}`,
    status: 'completed',
    code: t.icd9cmCode
      ? {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-9-cm',
              code: t.icd9cmCode,
            },
          ],
          text: t.name,
        }
      : { text: t.name },
    subject: {
      reference: `Patient/${konteks.organization.id}:${pasien.medicalRecordNumber}`,
      display: pasien.name,
    },
    encounter: { reference: `Encounter/${konteks.organization.id}:${e.encounterNumber}` },
    performedDateTime: waktu(t.performedAt),
  }
}

export function mapMedicationRequest(
  r: DataKunjungan['prescriptions'][number],
  pasien: DataKunjungan['patient'],
  e: DataKunjungan['encounter'],
  konteks: KonteksMapper
): Array<Record<string, unknown>> {
  return r.items.map((item) => ({
    resourceType: 'MedicationRequest',
    id: `MedicationRequest/${konteks.organization.id}:${r.prescriptionNumber}:${item.id}`,
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: item.kfaCode
        ? [{ system: 'https://fhir.kemkes.go.id/CodeSystem/kfa', code: item.kfaCode }]
        : undefined,
      text: [item.drugName, item.strength, item.form].filter(Boolean).join(' '),
    },
    subject: {
      reference: `Patient/${konteks.organization.id}:${pasien.medicalRecordNumber}`,
    },
    encounter: { reference: `Encounter/${konteks.organization.id}:${e.encounterNumber}` },
    authoredOn: waktu(e.lockedAt),
    dosageInstruction: [{ text: item.usage, doseAndRate: item.quantity ? [{ doseQuantity: { value: item.quantity } }] : undefined }],
  }))
}

export function mapComposition(
  data: DataKunjungan,
  konteks: KonteksMapper
): Record<string, unknown> {
  const { encounter: e, patient: p } = data
  return {
    resourceType: 'Composition',
    id: `Composition/${konteks.organization.id}:${e.encounterNumber}`,
    status: 'final',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '34117-2',
          display: 'History and physical note',
        },
      ],
    },
    title: `Resume kunjungan ${e.encounterNumber} — ${konteks.organization.name}`,
    date: waktu(e.lockedAt),
    subject: {
      reference: `Patient/${konteks.organization.id}:${p.medicalRecordNumber}`,
      display: p.name,
    },
    encounter: { reference: `Encounter/${konteks.organization.id}:${e.encounterNumber}` },
    author: [{ display: konteks.organization.name }],
    section: [
      e.chiefComplaint || data.anamnesisKeluhan
        ? { title: 'Anamnesis', text: { status: 'generated', div: `<p>${e.chiefComplaint ?? data.anamnesisKeluhan ?? ''}</p>` } }
        : undefined,
      data.rencanaTatalaksana
        ? { title: 'Rencana tatalaksana', text: { status: 'generated', div: `<p>${data.rencanaTatalaksana}</p>` } }
        : undefined,
      data.edukasi ? { title: 'Edukasi', text: { status: 'generated', div: `<p>${data.edukasi}</p>` } } : undefined,
    ].filter(Boolean),
  }
}
