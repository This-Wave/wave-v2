import { useEffect, useState } from "react";
import { getLastCheckpointId, setLastCheckpointId } from "../lib/preferences";

/** Hydrate saved checkpoint once the list is available. */
export function useLastCheckpoint(checkpointIds: string[] | undefined) {
  const [checkpointId, setCheckpointIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!checkpointIds?.length || hydrated) return;
    let cancelled = false;
    (async () => {
      const saved = await getLastCheckpointId();
      if (cancelled) return;
      if (saved && checkpointIds.includes(saved)) {
        setCheckpointIdState(saved);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkpointIds, hydrated]);

  function selectCheckpoint(id: string) {
    setCheckpointIdState(id);
    void setLastCheckpointId(id);
  }

  const resolvedId =
    checkpointId && checkpointIds?.includes(checkpointId)
      ? checkpointId
      : (checkpointIds?.[0] ?? null);

  return { checkpointId: resolvedId, selectCheckpoint, hydrated };
}
