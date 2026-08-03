/**
 * Seeds the four Wave dev accounts into Supabase Auth.
 *
 * Why this script exists: the four dev users were originally created by hand in
 * the Supabase dashboard, so when the project was deleted (see PLAN.md Phase 1)
 * recovering them was a multi-hour manual job. This makes it one command.
 *
 * The important part is that every account is created with a **pinned UUID**.
 * `Profile.id` in Neon *is* the Supabase auth user id — `profiles/routes.ts`
 * writes `id: data.user.id` — and `prisma/seed.ts` hardcodes these same four
 * UUIDs on the profiles it creates. If Supabase minted fresh ids here, every
 * seeded profile, order and verification would point at a user that no longer
 * exists. So the ids below are canonical and must stay in step with
 * `prisma/seed.ts`.
 *
 * Run `npm run db:seed` (Neon profiles) before this. Order matters only for the
 * consistency check at the end; the auth users can be created either way round.
 *
 * Usage:
 *   npm run db:seed:auth
 *   npm run db:seed:auth -- --force   # delete + recreate on a UUID conflict
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const here = __dirname;

/**
 * The four dev accounts. `id` must match the UUID `prisma/seed.ts` writes to
 * the corresponding Profile row — change one and you must change both.
 */
const FIXTURES = [
  {
    id: "54b6d4ba-bbdf-4d1b-a17a-6aeecea01633",
    phone: "+233201234567",
    password: "WaveShop123!",
    fullName: "Mama Put Kitchen (Owner)",
    role: "shop_owner",
  },
  {
    id: "6a2f924d-256d-4599-a239-6b71ce9a7e25",
    phone: "+233241234567",
    password: "WaveDev123!",
    fullName: "Ama Owusu",
    role: "student",
  },
  {
    id: "4e45b6f3-0da4-446b-a547-2cf8138028e0",
    phone: "+233551234567",
    password: "WaveRider123!",
    fullName: "Kofi Boateng",
    role: "rider",
  },
  {
    id: "f9aa5728-6af6-4d0b-9609-a079e1eea924",
    phone: "+233271234567",
    password: "WaveAdmin123!",
    fullName: "Wave Platform Admin",
    role: "admin",
  },
] as const;

type Fixture = (typeof FIXTURES)[number];

/**
 * Minimal .env reader. Vars already in the environment always win, so
 * `SUPABASE_URL=... npm run db:seed:auth` overrides the files. We fall back to
 * `packages/api/.env` because that is the only file in the repo that carries
 * the service-role key — `packages/db/.env` holds DATABASE_URL alone.
 */
function loadEnvFiles(): void {
  const candidates = [resolve(here, "../.env"), resolve(here, "../../api/.env")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
      const key = match?.[1];
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = (match?.[2] ?? "").trim().replace(/^["'](.*)["']$/, "$1");
    }
  }
}

/**
 * GoTrue stores phones in E.164 *without* the leading `+`, so a fixture's
 * `+233241234567` comes back as `233241234567`. Compare on digits only.
 */
function samePhone(a: string | undefined, b: string): boolean {
  return (a ?? "").replace(/\D/g, "") === b.replace(/\D/g, "");
}

type Outcome = "created" | "updated" | "conflict";

function statusOf(error: unknown): number | undefined {
  return (error as { status?: number } | null)?.status;
}

/**
 * auth-js reduces every transport failure to the message `fetch failed` and
 * drops the cause, so a deleted project and a flaky wifi look identical. Say
 * what to check instead — a project that no longer resolves is exactly the
 * failure PLAN.md Phase 1 describes.
 */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("fetch failed")) return message;
  return (
    `${message} — could not reach ${process.env.SUPABASE_URL}. Check the host resolves; ` +
    `a deleted Supabase project returns NXDOMAIN, whereas a paused one still answers.`
  );
}

async function seedUser(
  admin: SupabaseClient["auth"]["admin"],
  fixture: Fixture,
  force: boolean,
): Promise<Outcome> {
  const attributes = {
    phone: fixture.phone,
    password: fixture.password,
    // Dev accounts sign in with a password and must not need an SMS round trip
    // — mNotify may not be configured, and in CI it certainly isn't.
    phone_confirm: true,
    user_metadata: { full_name: fixture.fullName, seeded_role: fixture.role },
  };

  const lookup = await admin.getUserById(fixture.id);
  // A 404 is the answer "no such user" and means we should create one. Anything
  // else — an unreachable host, a bad service-role key — must stop the run, or
  // we'd fall through and misreport a dead project as a phone conflict.
  if (lookup.error && statusOf(lookup.error) !== 404) {
    throw new Error(`look up ${fixture.role}: ${describe(lookup.error)}`);
  }
  if (lookup.data?.user) {
    const { error } = await admin.updateUserById(fixture.id, attributes);
    if (error) throw new Error(`update ${fixture.role}: ${describe(error)}`);
    return "updated";
  }

  const { data, error } = await admin.createUser({ id: fixture.id, ...attributes });

  if (error) {
    // The one failure worth handling: an auth user already holds this phone
    // under a *different* id. Creating another is impossible and leaving it
    // alone means sign-in works but resolves to a profile that doesn't exist.
    const clash = await findUserByPhone(admin, fixture.phone);
    if (!clash) throw new Error(`create ${fixture.role}: ${describe(error)}`);

    if (!force) {
      console.error(
        `  ✗ ${fixture.role} (${fixture.phone}): an auth user already exists on this ` +
          `phone with id ${clash.id}, but the seed expects ${fixture.id}.\n` +
          `    Any profile keyed to the expected id would be unreachable. Re-run with ` +
          `--force to delete that user and recreate it with the pinned id.`,
      );
      return "conflict";
    }

    const { error: deleteError } = await admin.deleteUser(clash.id);
    if (deleteError) throw new Error(`delete clashing ${fixture.role}: ${describe(deleteError)}`);
    const retry = await admin.createUser({ id: fixture.id, ...attributes });
    if (retry.error) throw new Error(`recreate ${fixture.role}: ${describe(retry.error)}`);
    assertPinnedId(retry.data.user?.id, fixture);
    return "created";
  }

  assertPinnedId(data.user?.id, fixture);
  return "created";
}

/**
 * `id` on admin createUser is honoured by current GoTrue, but it is the single
 * assumption this whole script rests on. If a future Supabase release ignores
 * it we want a loud failure here, not a silently mismatched database.
 */
function assertPinnedId(actual: string | undefined, fixture: Fixture): void {
  if (actual === fixture.id) return;
  throw new Error(
    `Supabase ignored the pinned id for ${fixture.role}: asked for ${fixture.id}, got ${actual}. ` +
      `Profiles in Neon are keyed to the pinned id, so this account is unusable.`,
  );
}

async function findUserByPhone(
  admin: SupabaseClient["auth"]["admin"],
  phone: string,
): Promise<{ id: string } | null> {
  // listUsers has no phone filter, so page through. A dev project holds a
  // handful of users; this is not a hot path.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${describe(error)}`);
    const hit = data.users.find((user) => samePhone(user.phone, phone));
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Auth users alone don't make a working account — the app resolves the signed-in
 * user to a Neon Profile by id, and a missing one means sign-in succeeds and
 * then every authenticated route 401s. Report rather than fix: creating profiles
 * is `prisma/seed.ts`'s job.
 */
async function checkProfiles(prisma: PrismaClient): Promise<void> {
  const profiles = await prisma.profile.findMany({
    where: { OR: FIXTURES.map((f) => ({ id: f.id })) },
    select: { id: true, phone: true, role: true },
  });
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const missing = FIXTURES.filter((f) => !byId.has(f.id));
  if (missing.length > 0) {
    console.warn(
      `\n⚠ No Neon profile for: ${missing.map((f) => f.role).join(", ")}. ` +
        `Run \`npm run db:seed\` — these accounts can sign in but will 401 on every route.`,
    );
  }

  for (const fixture of FIXTURES) {
    const profile = byId.get(fixture.id);
    if (!profile) continue;
    if (profile.role !== fixture.role) {
      console.warn(
        `⚠ ${fixture.phone}: profile role is "${profile.role}", seed fixture says "${fixture.role}".`,
      );
    }
    if (!samePhone(profile.phone, fixture.phone)) {
      console.warn(
        `⚠ ${fixture.role}: profile phone is "${profile.phone}", auth user is "${fixture.phone}". ` +
          `Sign-in resolves by id so this still works, but the two records disagree.`,
      );
    }
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  const force = process.argv.includes("--force");

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Set them in " +
        "packages/api/.env or pass them in the environment.",
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Seeding auth users into ${url}`);
  const results: Outcome[] = [];
  for (const fixture of FIXTURES) {
    const outcome = await seedUser(supabase.auth.admin, fixture, force);
    results.push(outcome);
    if (outcome !== "conflict") {
      console.log(`  ${outcome === "created" ? "+" : "="} ${fixture.role.padEnd(10)} ${fixture.phone}`);
    }
  }

  const prisma = new PrismaClient();
  try {
    await checkProfiles(prisma);
  } finally {
    await prisma.$disconnect();
  }

  const conflicts = results.filter((r) => r === "conflict").length;
  console.log(
    `\nDone: ${results.filter((r) => r === "created").length} created, ` +
      `${results.filter((r) => r === "updated").length} updated` +
      (conflicts > 0 ? `, ${conflicts} unresolved conflict(s)` : ""),
  );
  console.log("Passwords for these accounts are listed in PLAN.md (Phase 1).");

  if (conflicts > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
