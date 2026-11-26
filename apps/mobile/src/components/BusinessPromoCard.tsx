import { PromoCard } from "./v6";
import { useViewerUniversityId } from "../store/authStore";
import { useUniversities } from "../lib/checkpoints";

/**
 * Home's ad for campus business owners. Says the one thing that trips people
 * up (no on-campus delivery) before they tap, and opens the lead form.
 */
export function BusinessPromoCard({ onPress }: { onPress: () => void }) {
  const universityId = useViewerUniversityId();
  const { data: universities } = useUniversities();
  const campus = universities?.find((u) => u.id === universityId)?.name;
  return (
    <PromoCard
      headline={campus ? `Own a business on ${campus} campus?` : "Own a business on campus?"}
      body="We can bring your stock, or your shop's orders, up from Accra. We don't deliver within campus."
      cta="Tell us about it"
      onPress={onPress}
    />
  );
}
