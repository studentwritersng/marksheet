-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "keywordText" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'short_tail',
    "searchIntent" TEXT NOT NULL DEFAULT 'informational',
    "targetAudience" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "primaryKeywordId" TEXT,
    "secondaryKeywordIds" JSONB,
    "tags" JSONB,
    "categoryId" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "featuredImageUrl" TEXT,
    "featuredImageAltText" TEXT,
    "schemaType" TEXT NOT NULL DEFAULT 'BlogPosting',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiBlogDraftRequest" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT,
    "topicText" TEXT,
    "targetAudience" TEXT,
    "requestedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "generatedTitleOptions" JSONB,
    "generatedSubtitle" TEXT,
    "generatedExcerpt" TEXT,
    "generatedBody" TEXT,
    "generatedMetaTitle" TEXT,
    "generatedMetaDescription" TEXT,
    "generatedTags" JSONB,
    "generatedImagePrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiBlogDraftRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsConfig" (
    "id" TEXT NOT NULL,
    "ga4MeasurementId" TEXT,
    "consentModeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionEventDefinition" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "ga4EventMapping" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConversionEventDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Keyword_status_idx" ON "Keyword"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BlogCategory_slug_key" ON "BlogCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_idx" ON "BlogPost"("status");

-- CreateIndex
CREATE INDEX "BlogPost_publishedAt_idx" ON "BlogPost"("publishedAt");

-- CreateIndex
CREATE INDEX "AiBlogDraftRequest_status_idx" ON "AiBlogDraftRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEventDefinition_eventName_key" ON "ConversionEventDefinition"("eventName");

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_primaryKeywordId_fkey" FOREIGN KEY ("primaryKeywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

