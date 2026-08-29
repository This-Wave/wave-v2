import type { Env } from "./env";

/** Comma-separated browser origins allowed to call the API (checklist H3). */
export function parseCorsOrigins(env: Env): boolean | string[] {
  if (env.CORS_ORIGINS) {
    const origins = env.CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      throw new Error("CORS_ORIGINS is set but empty");
    }
    return origins;
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "CORS_ORIGINS is required in production — comma-separated admin + student web origins",
    );
  }
  return true;
}
