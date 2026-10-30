-- Development reset required: legacy accounts have no passwords and are not migrated.
DROP INDEX "User_telegramId_key";
ALTER TABLE "User" DROP COLUMN "telegramId",
    ALTER COLUMN "username" SET NOT NULL,
    ADD COLUMN "passwordHash" TEXT NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
