-- Migration: Add Vapi + Google Calendar fields to Organization; add Call model

-- ── Organization: Vapi fields ──
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "vapiApiKey"         TEXT,
  ADD COLUMN IF NOT EXISTS "vapiPhoneNumberId"  TEXT,
  ADD COLUMN IF NOT EXISTS "vapiAssistantId"    TEXT,
  ADD COLUMN IF NOT EXISTS "vapiInboundNumber"  TEXT,
  ADD COLUMN IF NOT EXISTS "googleAccessToken"  TEXT,
  ADD COLUMN IF NOT EXISTS "googleRefreshToken" TEXT;

-- ── Call model ──
CREATE TABLE IF NOT EXISTS "calls" (
  "id"                TEXT        NOT NULL,
  "vapiCallId"        TEXT        NOT NULL,
  "status"            TEXT        NOT NULL DEFAULT 'queued',
  "direction"         TEXT        NOT NULL DEFAULT 'outbound',
  "endedReason"       TEXT,
  "duration"          INTEGER     NOT NULL DEFAULT 0,
  "cost"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "assistantType"     TEXT,
  "transcript"        TEXT,
  "summary"           TEXT,
  "successEvaluation" TEXT,
  "structuredData"    JSONB,
  "recordingUrl"      TEXT,
  "leadId"            TEXT        NOT NULL,
  "organizationId"    TEXT        NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt"         TIMESTAMP(3),
  "endedAt"           TIMESTAMP(3),
  CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- Unique + indexes
CREATE UNIQUE INDEX IF NOT EXISTS "calls_vapiCallId_key" ON "calls"("vapiCallId");
CREATE INDEX IF NOT EXISTS "calls_leadId_idx"              ON "calls"("leadId");
CREATE INDEX IF NOT EXISTS "calls_vapiCallId_idx"          ON "calls"("vapiCallId");
CREATE INDEX IF NOT EXISTS "calls_organizationId_createdAt_idx" ON "calls"("organizationId", "createdAt");

-- Foreign keys (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calls_leadId_fkey'
  ) THEN
    ALTER TABLE "calls"
      ADD CONSTRAINT "calls_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calls_organizationId_fkey'
  ) THEN
    ALTER TABLE "calls"
      ADD CONSTRAINT "calls_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id");
  END IF;
END $$;
