const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`API error ${status}: ${body}`);
    this.name = "ApiError";
  }
}

/**
 * Turns a failed request into something worth showing in a form. The API
 * answers with `{ error, details }` where `details` is a flattened Zod error,
 * so the field-level reason is the useful part — "name: String must contain at
 * least 1 character(s)" rather than a wall of JSON.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!(error instanceof ApiError)) return fallback;
  try {
    const parsed = JSON.parse(error.body) as {
      error?: string;
      details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    };
    const fieldErrors = Object.entries(parsed.details?.fieldErrors ?? {})
      .map(([field, messages]) => `${field}: ${messages?.[0] ?? "invalid"}`)
      .join(", ");
    return fieldErrors || parsed.details?.formErrors?.[0] || parsed.error || fallback;
  } catch {
    return error.body || fallback;
  }
}

export async function apiFetch<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
