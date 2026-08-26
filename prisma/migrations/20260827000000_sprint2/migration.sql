-- CreateEnum
CREATE TYPE "AssetCriticality" AS ENUM ('critical', 'high', 'medium', 'low', 'unknown');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('unverified', 'in_scope', 'out_of_scope', 'compromised', 'not_compromised');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('open', 'retest', 'fixed', 'accepted_risk', 'false_positive');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'queued', 'generating', 'generated', 'failed');

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "hostname" TEXT,
    "ip_address" TEXT,
    "os_fingerprint" TEXT,
    "open_ports" JSONB,
    "business_unit" TEXT,
    "criticality" "AssetCriticality" NOT NULL DEFAULT 'unknown',
    "status" "AssetStatus" NOT NULL DEFAULT 'unverified',
    "discovered_by" TEXT,
    "sentinel_asset_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_asset" (
    "projectId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_asset_pkey" PRIMARY KEY ("projectId","assetId")
);

-- CreateTable
CREATE TABLE "finding" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type_id" TEXT,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'open',
    "cve" TEXT,
    "cwe" TEXT,
    "cvss_score" DECIMAL(4,1),
    "cvss_vector" TEXT,
    "description" TEXT,
    "mitigation" TEXT,
    "replication" TEXT,
    "attack_techniques" TEXT[],
    "references" TEXT[],
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_asset" (
    "findingId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "finding_asset_pkey" PRIMARY KEY ("findingId","assetId")
);

-- CreateTable
CREATE TABLE "observation" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'info',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_tag" (
    "findingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "finding_tag_pkey" PRIMARY KEY ("findingId","tagId")
);

-- CreateTable
CREATE TABLE "finding_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "finding_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "exec_summary" TEXT,
    "conclusion" TEXT,
    "file_path" TEXT,
    "archived_at" TIMESTAMP(3),
    "generated_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cloned_from_id" TEXT,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_finding" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "source_id" TEXT,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'open',
    "cve" TEXT,
    "cwe" TEXT,
    "cvss_score" DECIMAL(4,1),
    "cvss_vector" TEXT,
    "description" TEXT,
    "mitigation" TEXT,
    "replication" TEXT,
    "attack_techniques" TEXT[],

    CONSTRAINT "report_finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "report_id" TEXT,
    "finding_id" TEXT,
    "file_path" TEXT NOT NULL,
    "caption" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_criticality_idx" ON "asset"("criticality");

-- CreateIndex
CREATE INDEX "asset_status_idx" ON "asset"("status");

-- CreateIndex
CREATE INDEX "finding_project_id_idx" ON "finding"("project_id");

-- CreateIndex
CREATE INDEX "finding_severity_idx" ON "finding"("severity");

-- CreateIndex
CREATE INDEX "finding_status_idx" ON "finding"("status");

-- CreateIndex
CREATE INDEX "observation_project_id_idx" ON "observation"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "finding_type_name_key" ON "finding_type"("name");

-- CreateIndex
CREATE INDEX "report_project_id_idx" ON "report"("project_id");

-- CreateIndex
CREATE INDEX "report_status_idx" ON "report"("status");

-- CreateIndex
CREATE INDEX "report_finding_report_id_idx" ON "report_finding"("report_id");

-- CreateIndex
CREATE INDEX "evidence_report_id_idx" ON "evidence"("report_id");

-- CreateIndex
CREATE INDEX "evidence_finding_id_idx" ON "evidence"("finding_id");

-- AddForeignKey
ALTER TABLE "engagement_asset" ADD CONSTRAINT "engagement_asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_asset" ADD CONSTRAINT "engagement_asset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding" ADD CONSTRAINT "finding_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding" ADD CONSTRAINT "finding_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "finding_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding" ADD CONSTRAINT "finding_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_asset" ADD CONSTRAINT "finding_asset_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_asset" ADD CONSTRAINT "finding_asset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation" ADD CONSTRAINT "observation_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_tag" ADD CONSTRAINT "finding_tag_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_tag" ADD CONSTRAINT "finding_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_cloned_from_id_fkey" FOREIGN KEY ("cloned_from_id") REFERENCES "report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_finding" ADD CONSTRAINT "report_finding_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

