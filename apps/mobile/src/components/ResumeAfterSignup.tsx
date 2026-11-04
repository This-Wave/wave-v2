import { useEffect } from "react";
import { navigationRef } from "../lib/navigationRef";
import { useAuthStore } from "../store/authStore";

/**
 * Puts a guest who just created an account back where they pressed Pay.
 *
 * Mounted inside the student navigator. The resume target is taken (and so
 * cleared) once, the first time the navigator is ready with a real profile.
 */
export function ResumeAfterSignup() {
  const hasProfile = useAuthStore((s) => !!s.profile);
  const pending = useAuthStore((s) => !!s.resume);

  useEffect(() => {
    if (!hasProfile || !pending) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (navigationRef.isReady()) {
        clearInterval(timer);
        const target = useAuthStore.getState().takeResume();
        if (target) {
          (navigationRef.navigate as unknown as (route: string, params?: object) => void)(target.route, target.params);
        }
      } else if (tries > 40) {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [hasProfile, pending]);

  return null;
}
