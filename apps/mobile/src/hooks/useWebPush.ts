import { useCallback, useEffect, useState } from "react";
import { disableWebPush, enableWebPush, getWebPushState, type WebPushState } from "../lib/webPush";

/** Web notification state for a settings row or prompt. `null` while checking. */
export function useWebPush() {
  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getWebPushState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = useCallback(() => {
    setBusy(true);
    setError(null);
    // Called straight from onPress so the browser still counts it as a tap.
    enableWebPush()
      .then(setState)
      .catch(() => setError("Couldn't turn on notifications. Try again."))
      .finally(() => setBusy(false));
  }, []);

  const turnOff = useCallback(() => {
    setBusy(true);
    setError(null);
    disableWebPush()
      .then(() => setState("off"))
      .finally(() => setBusy(false));
  }, []);

  return { state, busy, error, turnOn, turnOff };
}
