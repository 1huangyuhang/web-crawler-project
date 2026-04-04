-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrawlerType" AS ENUM ('LINK', 'CONTENT', 'IMAGE');

-- CreateTable
CREATE TABLE "CrawlRecord" (
    "id" TEXT NOT NULL,
    "type" "CrawlerType" NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "status" "CrawlStatus" NOT NULL DEFAULT 'COMPLETED',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "time" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "data" JSONB,
    "error" TEXT,
    "configId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlQueue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CrawlQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlStats" (
    "id" TEXT NOT NULL,
    "crawlId" TEXT NOT NULL,
    "totalUrls" INTEGER NOT NULL DEFAULT 0,
    "successUrls" INTEGER NOT NULL DEFAULT 0,
    "failedUrls" INTEGER NOT NULL DEFAULT 0,
    "totalLinks" INTEGER NOT NULL DEFAULT 0,
    "totalImages" INTEGER NOT NULL DEFAULT 0,
    "totalContent" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlerConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "maxDepth" INTEGER NOT NULL DEFAULT 3,
    "maxPages" INTEGER NOT NULL DEFAULT 100,
    "timeout" INTEGER NOT NULL DEFAULT 30,
    "userAgent" TEXT,
    "headers" JSONB,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrawlRecord_type_status_idx" ON "CrawlRecord"("type", "status");

-- CreateIndex
CREATE INDEX "CrawlRecord_type_status_createdAt_idx" ON "CrawlRecord"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CrawlRecord_createdAt_idx" ON "CrawlRecord"("createdAt");

-- CreateIndex
CREATE INDEX "CrawlRecord_targetUrl_status_idx" ON "CrawlRecord"("targetUrl", "status");

-- CreateIndex
CREATE INDEX "CrawlRecord_configId_idx" ON "CrawlRecord"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "CrawlQueue_status_priority_createdAt_idx" ON "CrawlQueue"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "CrawlQueue_type_idx" ON "CrawlQueue"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlStats_crawlId_key" ON "CrawlStats"("crawlId");

-- CreateIndex
CREATE INDEX "CrawlStats_crawlId_idx" ON "CrawlStats"("crawlId");

-- CreateIndex
CREATE INDEX "CrawlStats_createdAt_idx" ON "CrawlStats"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AccessLog_ipAddress_idx" ON "AccessLog"("ipAddress");

-- CreateIndex
CREATE INDEX "AccessLog_endpoint_idx" ON "AccessLog"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlerConfig_name_key" ON "CrawlerConfig"("name");

-- CreateIndex
CREATE INDEX "CrawlerConfig_type_isActive_idx" ON "CrawlerConfig"("type", "isActive");

-- CreateIndex
CREATE INDEX "CrawlerConfig_name_idx" ON "CrawlerConfig"("name");

-- AddForeignKey
ALTER TABLE "CrawlRecord" ADD CONSTRAINT "CrawlRecord_configId_fkey" FOREIGN KEY ("configId") REFERENCES "CrawlerConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
