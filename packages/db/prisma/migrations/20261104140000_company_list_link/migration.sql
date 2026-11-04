-- A private, login-free list link per delivery company (stored as a SHA-256).
ALTER TABLE "delivery_companies" ADD COLUMN "list_token_hash" TEXT;
CREATE UNIQUE INDEX "delivery_companies_list_token_hash_key" ON "delivery_companies"("list_token_hash");
