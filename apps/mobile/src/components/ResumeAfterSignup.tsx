import { useEffect } from "react";
import { navigationRef } from "../lib/navigationRef";
import { useAuthStore } from "../store/authStore";

/**
 * Puts a guest back where they pressed Pay: after creating an account, or
 * after backing out of sign-up to keep browsing.
 *
 * Mounted inside the student navigator, which is unmounted while sign-up runs.
 * The resume target is taken (and so cleared) once, when it mounts again.
 */
export function ResumeAfterSignup() {
  const canResume = useAuthStore((s) => !!s.profile || (!!s.guestUniversityId && !s.signingUpFromGuest));
  const pending = useAuthStore((s) => !!s.resume);

  useEffect(() => {
    if (!canResume || !pending) return;
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
  }, [canResume, pending]);

  return null;
}
