"use client";

import { useCallback, useEffect, useState, type DependencyList } from "react";

export interface ApiQueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

/**
 * Loads admin API data with visible error + retry instead of silent `.catch(() => {})`.
 */
export function useApiQuery<T>(
  fetcher: () => Promise<T> | null,
  deps: DependencyList,
  errorMessage = "Could not load data. Check your connection and try again.",
): ApiQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const retry = useCallback(async () => {
    const work = fetcher();
    if (!work) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await work);
    } catch {
      setData(null);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void retry();
  }, [retry]);

  return { data, error, loading, retry };
}
