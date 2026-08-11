import { createClient } from "@supabase/supabase-js";
import type { Env } from "../../config/env";

export const VERIFICATION_BUCKET = "verifications";

/**
 * Short by design. These URLs are minted per request and handed straight to the
 * page that is about to render them, so they only need to outlive the response.
 * The old 7-day TTL existed because the URL was *persisted*, which is the bug
 * this replaces: review broke a week after submission.
 */
export const VERIFICATION_SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Rows written before the path migration still hold an absolute URL. */
function isLegacyAbsoluteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

type VerificationRow = { idImagePath: string; selfiePath: string };

export type SignedVerification<T extends VerificationRow> = Omit<T, "idImagePath" | "selfiePath"> & {
  idImageUrl: string | null;
  selfieUrl: string | null;
};

/**
 * Swaps the stored Storage paths for freshly signed URLs, so responses keep the
 * `idImageUrl` / `selfieUrl` shape every client already renders.
 *
 * Signing is best-effort per image: one unreadable object returns `null` for
 * that thumbnail rather than failing the whole verification queue, which is the
 * difference between an admin seeing a missing image and seeing nothing at all.
 */
export async function signVerificationImages<T extends VerificationRow>(
  config: Pick<Env, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">,
  rows: T[],
  log?: { warn: (obj: unknown, msg: string) => void },
): Promise<SignedVerification<T>[]> {
  const paths = [
    ...new Set(
      rows
        .flatMap((row) => [row.idImagePath, row.selfiePath])
        .filter((value) => value && !isLegacyAbsoluteUrl(value)),
    ),
  ];

  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    // One round trip for the whole page of verifications, not two per row.
    const { data, error } = await supabase.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUrls(paths, VERIFICATION_SIGNED_URL_TTL_SECONDS);
    if (error) {
      log?.warn(error, "failed to sign verification images");
    } else {
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl && !entry.error) signed.set(entry.path, entry.signedUrl);
      }
    }
  }

  const resolve = (value: string): string | null => {
    if (!value) return null;
    if (isLegacyAbsoluteUrl(value)) return value;
    return signed.get(value) ?? null;
  };

  return rows.map((row) => {
    const { idImagePath, selfiePath, ...rest } = row;
    return {
      ...rest,
      idImageUrl: resolve(idImagePath),
      selfieUrl: resolve(selfiePath),
    } as SignedVerification<T>;
  });
}

/**
 * The upload route names every object `<riderId>/<kind>-<ts>.<ext>`, so a path
 * that doesn't start with the caller's own id was not produced by them.
 *
 * Before this, submission took any `z.string().url()` from the client and the
 * admin page rendered it in an `<img src>` — a rider could point platform staff
 * at an arbitrary host, or at another rider's still-valid signed URL.
 */
export function ownsVerificationPath(path: string, riderId: string): boolean {
  return path.startsWith(`${riderId}/`) && !path.includes("..");
}
