-- CreateEnum
CREATE TYPE "TimelineOutcome" AS ENUM ('success', 'failed', 'blocked');

-- CreateEnum
CREATE TYPE "VerdictType" AS ENUM ('detected', 'not_detected', 'partial', 'detected_late', 'untested');

-- CreateEnum
CREATE TYPE "RuleRequestStatus" AS ENUM ('draft', 'pending_review', 'approved', 'deployed', 'rejected', 'verified');

-- CreateTable
CREATE TABLE "timeline_entry" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "asset_id" TEXT,
    "technique_id" TEXT,
    "tactic" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action_description" TEXT NOT NULL,
    "outcome" "TimelineOutcome" NOT NULL DEFAULT 'success',
    "operator_id" TEXT,
    "note" TEXT,
    "command" TEXT,
    "technical_notes" TEXT,
    "sequence_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_verdict" (
    "id" TEXT NOT NULL,
    "timeline_entry_id" TEXT NOT NULL,
    "matched_alert_id" TEXT,
    "verdict" "VerdictType" NOT NULL DEFAULT 'untested',
    "detection_delay_seconds" INTEGER,
    "confirmed_by_operator" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detection_verdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_request" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "technique_id" TEXT NOT NULL,
    "timeline_entry_id" TEXT,
    "draft_rule_xml" TEXT NOT NULL,
    "test_log_sample_path" TEXT,
    "justification" TEXT,
    "status" "RuleRequestStatus" NOT NULL DEFAULT 'draft',
    "requested_by_id" TEXT,
    "requested_at" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approved_at" TIMESTAMP(3),
    "deployed_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timeline_entry_project_id_idx" ON "timeline_entry"("project_id");

-- CreateIndex
CREATE INDEX "timeline_entry_technique_id_idx" ON "timeline_entry"("technique_id");

-- CreateIndex
CREATE INDEX "timeline_entry_timestamp_idx" ON "timeline_entry"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "detection_verdict_timeline_entry_id_key" ON "detection_verdict"("timeline_entry_id");

-- CreateIndex
CREATE INDEX "detection_verdict_verdict_idx" ON "detection_verdict"("verdict");

-- CreateIndex
CREATE INDEX "rule_request_status_idx" ON "rule_request"("status");

-- CreateIndex
CREATE INDEX "rule_request_technique_id_idx" ON "rule_request"("technique_id");

-- AddForeignKey
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entry" ADD CONSTRAINT "timeline_entry_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_verdict" ADD CONSTRAINT "detection_verdict_timeline_entry_id_fkey" FOREIGN KEY ("timeline_entry_id") REFERENCES "timeline_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_verdict" ADD CONSTRAINT "detection_verdict_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_request" ADD CONSTRAINT "rule_request_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_request" ADD CONSTRAINT "rule_request_timeline_entry_id_fkey" FOREIGN KEY ("timeline_entry_id") REFERENCES "timeline_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_request" ADD CONSTRAINT "rule_request_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

