-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "copyCounter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "summaryCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SummaryDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientRelation" TEXT NOT NULL DEFAULT 'PASIEN',
    "patientSnapshot" TEXT NOT NULL,
    "contentSnapshot" TEXT NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SummaryDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SummaryDocument_organizationId_issuedAt_idx" ON "SummaryDocument"("organizationId", "issuedAt");

-- CreateIndex
CREATE INDEX "SummaryDocument_noteId_idx" ON "SummaryDocument"("noteId");

-- CreateIndex
CREATE INDEX "SummaryDocument_patientId_idx" ON "SummaryDocument"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "SummaryDocument_organizationId_number_key" ON "SummaryDocument"("organizationId", "number");

-- AddForeignKey
ALTER TABLE "SummaryDocument" ADD CONSTRAINT "SummaryDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryDocument" ADD CONSTRAINT "SummaryDocument_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryDocument" ADD CONSTRAINT "SummaryDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryDocument" ADD CONSTRAINT "SummaryDocument_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
