-- Older connections/attempts remain unusable until reauthorized; never send their
-- tokens under a different partner identity after a configuration change.
ALTER TABLE "AuthorizationAttempt" ADD COLUMN "partnerId" TEXT NOT NULL DEFAULT 'UNBOUND';
ALTER TABLE "AuthorizationAttempt" ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'UNBOUND';
ALTER TABLE "ShopConnection" ADD COLUMN "partnerId" TEXT NOT NULL DEFAULT 'UNBOUND';
ALTER TABLE "AuthorizationAttempt" ALTER COLUMN "partnerId" DROP DEFAULT;
ALTER TABLE "AuthorizationAttempt" ALTER COLUMN "environment" DROP DEFAULT;
ALTER TABLE "ShopConnection" ALTER COLUMN "partnerId" DROP DEFAULT;
