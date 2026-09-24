import { gzipSync } from "node:zlib";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { createServerSupabaseClient } from "../../lib/supabaseServer";
import { recordAudit, SYSTEM_ACTOR } from "../../lib/audit";

export const AUDIT_ARCHIVE_BUCKET = "audit-archive";

/**
 * Must match `audit_event_retention_days()` in the
 * 20260923220000_audit_archive_prune migration. The database is the authority —
 * it refuses a DELETE of anything newer — so a mismatch here is not a data risk,
 * it just means the job tries to prune rows the trigger rejects.
 */
export const AUDIT_RETENTION_DAYS = 180;

/** One pass writes at most this many rows, so a long backlog drains over several runs. */
export const AUDIT_ARCHIVE_BATCH = 5_000;

export interface ArchiveResult {
  archived: number;
  object: string | null;
  /** Rows still past the window after this pass — a backlog draining over runs. */
  remaining: number;
}

/**
 * Move audit rows past the retention window out of Postgres and into object
 * storage, then delete them.
 *
 * **Why this exists.** The audit hook writes a row for every mutation and every
 * refusal, and Neon's free tier is 0.5GB. Left alone the table fills in roughly
 * 6-12 months at pilot volume, and a full table means audit INSERTs start
 * failing — which, because the hook runs on the request path, would take
 * ordinary writes down with it. So the log has to be trimmable without becoming
 * losable.
 *
 * **Order of operations is the whole design.** Upload first, verify the upload
 * by reading it back, and only then delete. A crash at any point leaves either
 * rows still in the table, or rows in the table *and* a copy in storage — never
 * a gap. The one thing it cannot do is delete something that was not safely
 * written, which is the only failure that would actually lose evidence.
 *
 * Storage rather than a second Postgres table: an archive in the same database
 * does not solve the problem that prompted it. Supabase Storage has its own 1GB
 * and, unlike the database, does not pause.
 *
 * NDJSON gzipped, because it is append-friendly, streams, diffs, and any
 * investigator can read it with `zcat | jq` a year from now without Wave's code.
 */
export async function archiveAuditEvents(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  /** Overridable so a test can pin the window; production uses the constant. */
  retentionDays?: number;
  batchSize?: number;
}): Promise<ArchiveResult> {
  const { fastify, log } = args;
  const retentionDays = args.retentionDays ?? AUDIT_RETENTION_DAYS;
  const batchSize = args.batchSize ?? AUDIT_ARCHIVE_BATCH;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const rows = await fastify.prisma.auditEvent.findMany({
    where: { occurredAt: { lt: cutoff } },
    orderBy: { occurredAt: "asc" },
    take: batchSize,
  });
  if (rows.length === 0) return { archived: 0, object: null, remaining: 0 };

  // Named for the window it covers, not for the moment it ran, so re-running
  // after a partial failure overwrites the same object rather than leaving two
  // half-copies nobody can tell apart.
  const first = rows[0]!.occurredAt.toISOString().slice(0, 10);
  const last = rows[rows.length - 1]!.occurredAt.toISOString().slice(0, 10);
  const object = `audit/${first}_to_${last}_${rows.length}.ndjson.gz`;

  const body = gzipSync(Buffer.from(rows.map((row) => JSON.stringify(row)).join("\n") + "\n"));

  const supabase = createServerSupabaseClient(
    fastify.config.SUPABASE_URL,
    fastify.config.SUPABASE_SERVICE_ROLE_KEY,
  );

  const uploaded = await supabase.storage
    .from(AUDIT_ARCHIVE_BUCKET)
    .upload(object, body, { contentType: "application/gzip", upsert: true });
  if (uploaded.error) {
    // Nothing is deleted, so the next run simply tries again.
    log.error({ object, error: uploaded.error.message }, "audit archive upload failed — nothing pruned");
    throw new Error(`audit archive upload failed: ${uploaded.error.message}`);
  }

  // Read it back before deleting anything. An upload that reported success but
  // stored nothing readable is exactly the case that would turn a prune into
  // data loss, and it is cheap to rule out.
  const readBack = await supabase.storage.from(AUDIT_ARCHIVE_BUCKET).download(object);
  const readBackSize = readBack.data ? (await readBack.data.arrayBuffer()).byteLength : 0;
  if (readBack.error || readBackSize !== body.byteLength) {
    log.error(
      { object, expected: body.byteLength, got: readBackSize, error: readBack.error?.message },
      "audit archive read-back did not match — nothing pruned",
    );
    throw new Error("audit archive read-back failed");
  }

  // `SET LOCAL` scopes the flag to this transaction, so it cannot leak onto
  // another request sharing the pooled connection, and a rollback takes it with
  // it. The trigger refuses the delete without it, and refuses it anyway for
  // any row newer than the window — the database is the backstop, not this
  // code's `where` clause.
  const ids = rows.map((row) => row.id);
  const deleted = await fastify.prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL wave.archiving = 'on'");
    return tx.auditEvent.deleteMany({ where: { id: { in: ids } } });
  });

  const remaining = await fastify.prisma.auditEvent.count({
    where: { occurredAt: { lt: cutoff } },
  });

  // Recorded in the log it just trimmed, which is the point: the fact that rows
  // were removed, how many, and where they went is itself auditable. An INSERT
  // is always allowed, so this cannot be refused by the trigger.
  await recordAudit(fastify, {
    action: "audit.archived",
    category: "system",
    actor: SYSTEM_ACTOR,
    entityType: "audit_event",
    entityId: object,
    metadata: {
      archived: deleted.count,
      object,
      bucket: AUDIT_ARCHIVE_BUCKET,
      retentionDays,
      oldest: first,
      newest: last,
      remaining,
    },
  });

  log.info({ object, archived: deleted.count, remaining }, "audit events archived and pruned");
  return { archived: deleted.count, object, remaining };
}
