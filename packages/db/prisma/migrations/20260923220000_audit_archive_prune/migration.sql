-- Let the archive job prune, and nothing else.
--
-- `audit_event` has refused every UPDATE and DELETE since it was created, which
-- is the property that makes it worth trusting. But Neon's free tier is 0.5GB
-- and the audit hook fires on every mutation, so left alone the table fills in
-- roughly 6-12 months at pilot volume — and when it fills, audit INSERTs start
-- failing, which takes writes down with them.
--
-- So the guard is narrowed rather than removed. A DELETE now has to satisfy
-- BOTH conditions:
--
--   1. the row is older than the retention window, and
--   2. the transaction has set `wave.archiving = 'on'`
--
-- Anything else still raises: every UPDATE, a DELETE of a recent row, a DELETE
-- from a psql session that has not set the flag, and TRUNCATE in all cases.
-- That keeps the one thing an append-only log must not allow — quietly editing
-- or dropping evidence of what happened last week — while allowing the one
-- thing operating it requires.
--
-- The flag is a transaction-local GUC set with `SET LOCAL`, so it cannot leak
-- into another transaction on the same pooled connection, and a crash mid-job
-- takes it with the rollback.

-- 180 days. Referenced by the job as AUDIT_RETENTION_DAYS; changing one means
-- changing both, which is why the number is named here rather than inlined.
CREATE OR REPLACE FUNCTION audit_event_retention_days() RETURNS integer AS $$
  SELECT 180;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION audit_event_is_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('wave.archiving', true) = 'on'
     AND OLD.occurred_at < now() - (audit_event_retention_days() || ' days')::interval
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'audit_event is append-only (% refused)', TG_OP
    USING ERRCODE = 'insufficient_privilege',
          HINT = 'Only the archive job may delete, and only rows past the retention window.';
END;
$$ LANGUAGE plpgsql;

-- The TRUNCATE trigger keeps pointing at the same function, and TRUNCATE has no
-- OLD row, so it can never satisfy the exemption above. Left untouched on
-- purpose: it is the one operation that could empty the table in a single
-- statement.
