-- CreateTable for social-referrer classification aggregation
CREATE TABLE "social_referrer_daily" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "claimedSource" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "uaFamily" TEXT NOT NULL DEFAULT 'other',
    "signalsKey" TEXT NOT NULL DEFAULT 'none',
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "social_referrer_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "social_referrer_daily_key"
    ON "social_referrer_daily"("date", "claimedSource", "verdict", "country", "uaFamily", "signalsKey");
CREATE INDEX "social_referrer_daily_date_idx" ON "social_referrer_daily"("date");
CREATE INDEX "social_referrer_daily_source_idx" ON "social_referrer_daily"("claimedSource");
CREATE INDEX "social_referrer_daily_verdict_idx" ON "social_referrer_daily"("verdict");
