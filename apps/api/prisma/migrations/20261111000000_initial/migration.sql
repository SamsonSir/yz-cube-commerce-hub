-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationAttempt" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorizationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopConnection" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopName" TEXT,
    "region" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "accessTokenCipher" TEXT NOT NULL,
    "refreshTokenCipher" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "refreshLeaseUntil" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationAttempt_stateHash_key" ON "AuthorizationAttempt"("stateHash");

-- CreateIndex
CREATE INDEX "AuthorizationAttempt_expiresAt_idx" ON "AuthorizationAttempt"("expiresAt");

-- CreateIndex
CREATE INDEX "ShopConnection_accessExpiresAt_status_idx" ON "ShopConnection"("accessExpiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShopConnection_appId_shopId_key" ON "ShopConnection"("appId", "shopId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

