"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-canvas font-sans text-ink p-8">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-muted">The admin dashboard hit an unexpected error.</p>
        <button
          type="button"
          className="mt-4 rounded-pill bg-lime px-4 py-2 text-sm font-medium text-ink"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
