-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('user', 'staff', 'system', 'webhook', 'anonymous');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('success', 'denied', 'failed');

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_role" TEXT,
    "actor_staff_role" TEXT,
    "actor_name" TEXT,
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "university_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'success',
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "method" TEXT,
    "path" TEXT,
    "status_code" INTEGER,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_occurred_at_idx" ON "audit_event"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_actor_id_occurred_at_idx" ON "audit_event"("actor_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_entity_type_entity_id_idx" ON "audit_event"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_event_category_occurred_at_idx" ON "audit_event"("category", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_university_id_occurred_at_idx" ON "audit_event"("university_id", "occurred_at" DESC);

-- Append-only, enforced where nobody can forget it. Any UPDATE or DELETE on
-- audit_event raises, whichever code path or console issued it. TRUNCATE is
-- blocked separately because it does not fire row triggers.
CREATE OR REPLACE FUNCTION audit_event_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only (% refused)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION audit_event_is_append_only();

CREATE TRIGGER audit_event_no_truncate
  BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_event_is_append_only();
