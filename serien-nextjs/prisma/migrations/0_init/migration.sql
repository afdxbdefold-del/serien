-- Baseline migration after Point-in-Time Recovery
-- All existing tables were preserved during PITR
-- This migration only adds the discover_audits table that was missing

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "discover_audits" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "discoverScore" INTEGER NOT NULL,
    "discoverMode" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "hasHero" BOOLEAN NOT NULL,
    "hasByline" BOOLEAN NOT NULL,
    "freshnessHours" INTEGER NOT NULL,
    "aiRiskScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discover_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "discover_audits_articleId_key" ON "discover_audits"("articleId");
CREATE INDEX IF NOT EXISTS "discover_audits_passed_idx" ON "discover_audits"("passed");
CREATE INDEX IF NOT EXISTS "discover_audits_discoverScore_idx" ON "discover_audits"("discoverScore");
CREATE INDEX IF NOT EXISTS "discover_audits_createdAt_idx" ON "discover_audits"("createdAt");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'discover_audits_articleId_fkey'
    ) THEN
        ALTER TABLE "discover_audits" ADD CONSTRAINT "discover_audits_articleId_fkey" 
        FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
