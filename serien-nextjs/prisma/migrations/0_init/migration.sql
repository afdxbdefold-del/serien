-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "favoriteStreamers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "tmdbId" INTEGER NOT NULL,
    "tmdbType" TEXT NOT NULL DEFAULT 'tv',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT,
    "originalName" TEXT,
    "overview" TEXT,
    "tagline" TEXT,
    "posterLocalUrl" TEXT,
    "backdropLocalUrl" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "status" TEXT,
    "type" TEXT,
    "firstAirDate" TIMESTAMP(3),
    "lastAirDate" TIMESTAMP(3),
    "numberOfSeasons" INTEGER,
    "numberOfEpisodes" INTEGER,
    "episodeRunTime" INTEGER[],
    "inProduction" BOOLEAN,
    "voteAverage" DOUBLE PRECISION,
    "voteCount" INTEGER,
    "popularity" DOUBLE PRECISION,
    "genres" TEXT[],
    "genresJson" JSONB,
    "networks" TEXT[],
    "networksJson" JSONB,
    "productionCompanies" TEXT[],
    "productionCountries" TEXT[],
    "spokenLanguages" TEXT[],
    "originalLanguage" TEXT,
    "cast" JSONB,
    "crew" JSONB,
    "seasons" JSONB,
    "trailers" JSONB,
    "keywords" TEXT[],
    "currentStatus" TEXT,
    "statusDescription" TEXT,
    "statusLastUpdate" TIMESTAMP(3),
    "lastSeasonNumber" INTEGER,
    "lastNewsDate" TIMESTAMP(3),
    "tmdbData" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_pkey" PRIMARY KEY ("tmdbId")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentHtml" TEXT NOT NULL,
    "heroLocalUrl" TEXT,
    "heroVideoUrl" TEXT,
    "tmdbId" INTEGER,
    "tmdbType" TEXT NOT NULL DEFAULT 'tv',
    "tmdbBackdropPath" TEXT,
    "tmdbPosterPath" TEXT,
    "heroImageUrl" TEXT,
    "ogImageUrl" TEXT,
    "cardImageUrl" TEXT,
    "imageAttribution" TEXT NOT NULL DEFAULT 'TMDB',
    "contentType" TEXT,
    "primarySeriesId" INTEGER NOT NULL DEFAULT 119051,
    "streamer" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "sourcePublishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "readingTime" INTEGER,
    "confidence" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "publishMode" TEXT NOT NULL DEFAULT 'DISCOVER',
    "wasBedeutetDasText" TEXT,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discover_score_dashboards" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pipelineVersion" TEXT NOT NULL DEFAULT 'serien_pipeline_v1',
    "headlineMetrics" JSONB NOT NULL,
    "contentMetrics" JSONB NOT NULL,
    "freshnessMetrics" JSONB NOT NULL,
    "imageMetrics" JSONB NOT NULL,
    "trustMetrics" JSONB NOT NULL,
    "discoverScore" DOUBLE PRECISION NOT NULL,
    "finalVerdict" TEXT NOT NULL,
    "primaryBlockers" TEXT[],
    "improvementHints" TEXT[],

    CONSTRAINT "discover_score_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "headline_comparisons" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "headline_original" TEXT NOT NULL,
    "headline_rewritten" TEXT,
    "antiAiScore_original" INTEGER,
    "antiAiScore_rewritten" INTEGER,
    "headline_delta" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NO_REWRITE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "headline_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_series" (
    "articleId" TEXT NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_series_pkey" PRIMARY KEY ("articleId","seriesId")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "userId" TEXT NOT NULL,
    "tmdbSeriesId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("userId","tmdbSeriesId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "type" INTEGER NOT NULL DEFAULT 301,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("fromPath")
);

-- CreateTable
CREATE TABLE "discover_audits" (
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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "series_tmdbId_key" ON "series"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "articles_sourceUrl_key" ON "articles"("sourceUrl");

-- CreateIndex
CREATE INDEX "articles_slug_idx" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_publishedAt_idx" ON "articles"("publishedAt");

-- CreateIndex
CREATE INDEX "articles_primarySeriesId_idx" ON "articles"("primarySeriesId");

-- CreateIndex
CREATE INDEX "discover_score_dashboards_articleId_idx" ON "discover_score_dashboards"("articleId");

-- CreateIndex
CREATE INDEX "discover_score_dashboards_timestamp_idx" ON "discover_score_dashboards"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "headline_comparisons_articleId_key" ON "headline_comparisons"("articleId");

-- CreateIndex
CREATE INDEX "headline_comparisons_articleId_idx" ON "headline_comparisons"("articleId");

-- CreateIndex
CREATE INDEX "headline_comparisons_status_idx" ON "headline_comparisons"("status");

-- CreateIndex
CREATE INDEX "headline_comparisons_createdAt_idx" ON "headline_comparisons"("createdAt");

-- CreateIndex
CREATE INDEX "article_series_articleId_idx" ON "article_series"("articleId");

-- CreateIndex
CREATE INDEX "article_series_seriesId_idx" ON "article_series"("seriesId");

-- CreateIndex
CREATE INDEX "comments_articleId_idx" ON "comments"("articleId");

-- CreateIndex
CREATE INDEX "notifications_userId_seen_idx" ON "notifications"("userId", "seen");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_fromPath_key" ON "redirects"("fromPath");

-- CreateIndex
CREATE UNIQUE INDEX "discover_audits_articleId_key" ON "discover_audits"("articleId");

-- CreateIndex
CREATE INDEX "discover_audits_passed_idx" ON "discover_audits"("passed");

-- CreateIndex
CREATE INDEX "discover_audits_discoverScore_idx" ON "discover_audits"("discoverScore");

-- CreateIndex
CREATE INDEX "discover_audits_createdAt_idx" ON "discover_audits"("createdAt");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_primarySeriesId_fkey" FOREIGN KEY ("primarySeriesId") REFERENCES "series"("tmdbId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discover_score_dashboards" ADD CONSTRAINT "discover_score_dashboards_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "headline_comparisons" ADD CONSTRAINT "headline_comparisons_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_series" ADD CONSTRAINT "article_series_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_series" ADD CONSTRAINT "article_series_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("tmdbId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_tmdbSeriesId_fkey" FOREIGN KEY ("tmdbSeriesId") REFERENCES "series"("tmdbId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discover_audits" ADD CONSTRAINT "discover_audits_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

