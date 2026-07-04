-- CreateTable for ad-fraud firewall aggregation
CREATE TABLE "ad_fraud_blocks_daily" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "botUa" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ad_fraud_blocks_daily_pkey" PRIMARY KEY ("id")
);

-- Unique combo prevents duplicate rows for same day/reason/country/UA-signal
CREATE UNIQUE INDEX "ad_fraud_blocks_daily_date_reason_country_botUa_key"
    ON "ad_fraud_blocks_daily"("date", "reason", "country", "botUa");
CREATE INDEX "ad_fraud_blocks_daily_date_idx" ON "ad_fraud_blocks_daily"("date");
CREATE INDEX "ad_fraud_blocks_daily_reason_idx" ON "ad_fraud_blocks_daily"("reason");
