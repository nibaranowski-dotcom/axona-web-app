-- CreateEnum
CREATE TYPE "SearchType" AS ENUM ('MODULE', 'AGENT', 'WORKFLOW', 'PROJECT', 'FILE', 'CHAT');

-- DropIndex
DROP INDEX "file_embedding_hnsw";

-- CreateTable
CREATE TABLE "SearchDoc" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "type" "SearchType" NOT NULL,
    "refId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT,
    "url" TEXT NOT NULL,
    "embedding" vector,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchDoc_orgId_idx" ON "SearchDoc"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchDoc_type_refId_key" ON "SearchDoc"("type", "refId");

-- AddForeignKey
ALTER TABLE "SearchDoc" ADD CONSTRAINT "SearchDoc_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
