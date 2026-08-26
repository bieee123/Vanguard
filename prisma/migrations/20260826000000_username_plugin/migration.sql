-- Username plugin (better-auth)
ALTER TABLE "user" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
ALTER TABLE "user" ADD COLUMN "display_username" TEXT;
