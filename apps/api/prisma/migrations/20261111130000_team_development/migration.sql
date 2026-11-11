ALTER TABLE "Session" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'WEB';
CREATE TABLE "DevelopmentGrant" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "tools" TEXT[] NOT NULL,
 CONSTRAINT "DevelopmentGrant_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "DevelopmentGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "DevelopmentGrant_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ShopConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DevelopmentGrant_userId_connectionId_key" ON "DevelopmentGrant"("userId", "connectionId");
