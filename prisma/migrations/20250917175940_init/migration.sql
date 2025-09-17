-- CreateTable
CREATE TABLE "public"."Link" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Click" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkId" TEXT NOT NULL,
    "ipHash" TEXT,
    "ua" TEXT,
    "referer" TEXT,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_slug_key" ON "public"."Link"("slug");

-- AddForeignKey
ALTER TABLE "public"."Click" ADD CONSTRAINT "Click_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "public"."Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
