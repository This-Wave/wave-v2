import { gunzipSync } from "node:zlib";
import { describe, expect, test, vi } from "vitest";
import { archiveAuditEvents, AUDIT_ARCHIVE_BUCKET } from "../archive";

/**
 * The audit archive's one hard guarantee: it never deletes a row it has not
 * safely written somewhere else.
 *
 * Every test here is really about ordering. Upload, verify by reading back,
 * then delete — so a failure at any step leaves the rows in the table, and the
 * worst case is a duplicate copy in storage rather than a hole in the log.
 */
vi.mock("../../../lib/supabaseServer", () => ({
  createServerSupabaseClient: () => storage,
}));

let storage: {
  storage: {
    from: (bucket: string) => {
      upload: ReturnType<typeof vi.fn>;
      download: ReturnType<typeof vi.fn>;
    };
  };
};

function makeStorage({
  uploadError,
  downloadError,
  corruptSize,
}: { uploadError?: string; downloadError?: string; corruptSize?: boolean } = {}) {
  const upload = vi.fn(async (_path: string, body: Buffer) => {
    lastBody = body;
    return uploadError ? { error: { message: uploadError }, data: null } : { error: null, data: {} };
  });
  const download = vi.fn(async () => {
    if (downloadError) return { error: { message: downloadError }, data: null };
    const bytes = corruptSize ? lastBody.subarray(0, 3) : lastBody;
    return { error: null, data: { arrayBuffer: async () => bytes.buffer.slice(0, bytes.byteLength) } };
  });
  const buckets: string[] = [];
  storage = { storage: { from: (b: string) => (buckets.push(b), { upload, download }) } };
  return { upload, download, buckets };
}

let lastBody: Buffer = Buffer.alloc(0);

const OLD_ROWS = [
  { id: "e1", occurredAt: new Date("2026-01-05T10:00:00Z"), action: "order.created" },
  { id: "e2", occurredAt: new Date("2026-01-06T10:00:00Z"), action: "payment.confirmed" },
];

function fakeFastify(rows: typeof OLD_ROWS, remaining = 0) {
  const deleteMany = vi.fn().mockResolvedValue({ count: rows.length });
  const executeRawUnsafe = vi.fn().mockResolvedValue(0);
  const audits: unknown[] = [];
  return {
    audits,
    deleteMany,
    executeRawUnsafe,
    fastify: {
      config: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" },
      prisma: {
        auditEvent: {
          findMany: vi.fn().mockResolvedValue(rows),
          count: vi.fn().mockResolvedValue(remaining),
          create: vi.fn(async ({ data }: { data: unknown }) => (audits.push(data), data)),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({ $executeRawUnsafe: executeRawUnsafe, auditEvent: { deleteMany } }),
      },
    } as never,
  };
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

describe("archiveAuditEvents", () => {
  test("uploads, reads back, then deletes — in that order", async () => {
    const { upload, download } = makeStorage();
    const { fastify, deleteMany } = fakeFastify(OLD_ROWS);

    const result = await archiveAuditEvents({ fastify, log });

    expect(upload).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledOnce();
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["e1", "e2"] } } });
    expect(result.archived).toBe(2);
    expect(result.object).toContain("2026-01-05_to_2026-01-06");
  });

  test("the uploaded object is gzipped NDJSON of the rows", async () => {
    // Readable with `zcat | jq` years later, without any of Wave's code.
    makeStorage();
    const { fastify } = fakeFastify(OLD_ROWS);

    await archiveAuditEvents({ fastify, log });

    const lines = gunzipSync(lastBody).toString("utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ id: "e1", action: "order.created" });
  });

  test("a failed upload deletes nothing", async () => {
    const { fastify, deleteMany } = fakeFastify(OLD_ROWS);
    makeStorage({ uploadError: "bucket not found" });

    await expect(archiveAuditEvents({ fastify, log })).rejects.toThrow(/upload failed/);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("an unreadable upload deletes nothing", async () => {
    const { fastify, deleteMany } = fakeFastify(OLD_ROWS);
    makeStorage({ downloadError: "not found" });

    await expect(archiveAuditEvents({ fastify, log })).rejects.toThrow(/read-back failed/);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("a truncated upload deletes nothing", async () => {
    // The case that would actually lose evidence: storage reports success but
    // stored less than was sent.
    const { fastify, deleteMany } = fakeFastify(OLD_ROWS);
    makeStorage({ corruptSize: true });

    await expect(archiveAuditEvents({ fastify, log })).rejects.toThrow(/read-back failed/);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("the delete runs inside a transaction that sets the archiving flag", async () => {
    // Without the flag the trigger refuses the delete, so this assertion is the
    // difference between the job working and silently pruning nothing.
    makeStorage();
    const { fastify, executeRawUnsafe } = fakeFastify(OLD_ROWS);

    await archiveAuditEvents({ fastify, log });

    expect(executeRawUnsafe).toHaveBeenCalledWith("SET LOCAL wave.archiving = 'on'");
  });

  test("nothing past the window is a no-op", async () => {
    const { upload } = makeStorage();
    const { fastify, deleteMany } = fakeFastify([]);

    const result = await archiveAuditEvents({ fastify, log });

    expect(result).toEqual({ archived: 0, object: null, remaining: 0 });
    expect(upload).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("records what it archived in the log it just trimmed", async () => {
    makeStorage();
    const { fastify, audits } = fakeFastify(OLD_ROWS, 120);

    await archiveAuditEvents({ fastify, log });

    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "audit.archived" });
    const metadata = (audits[0] as { metadata: Record<string, unknown> }).metadata;
    expect(metadata).toMatchObject({ archived: 2, bucket: AUDIT_ARCHIVE_BUCKET, remaining: 120 });
  });

  test("reports a backlog so a long tail drains over several runs", async () => {
    makeStorage();
    const { fastify } = fakeFastify(OLD_ROWS, 9_000);

    expect((await archiveAuditEvents({ fastify, log })).remaining).toBe(9_000);
  });

  test("only asks for rows past the retention window", async () => {
    makeStorage();
    const { fastify } = fakeFastify(OLD_ROWS);

    await archiveAuditEvents({ fastify, log, retentionDays: 30 });

    const where = (fastify as never as { prisma: { auditEvent: { findMany: { mock: { calls: [{ where: { occurredAt: { lt: Date } } }][] } } } } })
      .prisma.auditEvent.findMany.mock.calls[0]![0].where;
    const cutoff = where.occurredAt.lt.getTime();
    const expected = Date.now() - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5_000);
  });
});
