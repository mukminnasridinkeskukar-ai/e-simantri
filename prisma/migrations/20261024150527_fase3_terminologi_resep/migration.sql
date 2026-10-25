-- AlterTable
ALTER TABLE "ClinicalNoteVersion" ADD COLUMN     "codesSnapshot" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "rxCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Icd10Code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chapter" TEXT,
    "isSeedDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Icd10Code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Icd9CmCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "chapter" TEXT,
    "isSeedDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Icd9CmCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KfaCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosageForm" TEXT,
    "strength" TEXT,
    "unit" TEXT,
    "isSeedDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "KfaCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteDiagnosis" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "icd10CodeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "noteText" TEXT,
    "enteredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "NoteDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteProcedure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "icd9CmCodeId" TEXT NOT NULL,
    "noteText" TEXT,
    "enteredByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "NoteProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "kfaCodeId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dose" TEXT,
    "route" TEXT NOT NULL,
    "frequency" TEXT,
    "durationDays" INTEGER,
    "quantity" TEXT,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Icd10Code_code_key" ON "Icd10Code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Icd9CmCode_code_key" ON "Icd9CmCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "KfaCode_code_key" ON "KfaCode"("code");

-- CreateIndex
CREATE INDEX "NoteDiagnosis_organizationId_idx" ON "NoteDiagnosis"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteDiagnosis_noteId_icd10CodeId_key" ON "NoteDiagnosis"("noteId", "icd10CodeId");

-- CreateIndex
CREATE INDEX "NoteProcedure_organizationId_idx" ON "NoteProcedure"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteProcedure_noteId_icd9CmCodeId_key" ON "NoteProcedure"("noteId", "icd9CmCodeId");

-- CreateIndex
CREATE INDEX "Prescription_organizationId_idx" ON "Prescription"("organizationId");

-- CreateIndex
CREATE INDEX "Prescription_noteId_idx" ON "Prescription"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_organizationId_number_key" ON "Prescription"("organizationId", "number");

-- CreateIndex
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

-- AddForeignKey
ALTER TABLE "NoteDiagnosis" ADD CONSTRAINT "NoteDiagnosis_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteDiagnosis" ADD CONSTRAINT "NoteDiagnosis_icd10CodeId_fkey" FOREIGN KEY ("icd10CodeId") REFERENCES "Icd10Code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteDiagnosis" ADD CONSTRAINT "NoteDiagnosis_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteProcedure" ADD CONSTRAINT "NoteProcedure_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteProcedure" ADD CONSTRAINT "NoteProcedure_icd9CmCodeId_fkey" FOREIGN KEY ("icd9CmCodeId") REFERENCES "Icd9CmCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteProcedure" ADD CONSTRAINT "NoteProcedure_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_kfaCodeId_fkey" FOREIGN KEY ("kfaCodeId") REFERENCES "KfaCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
