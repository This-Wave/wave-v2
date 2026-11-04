import { Text } from "react-native";
import { Button, Sheet } from "./v6";
import { useAuthStore, type ResumeTarget } from "../store/authStore";

/**
 * "One step to pay": what a guest sees when they press Pay (canvas board 26b).
 *
 * The order stays on screen behind the sheet, so it is obvious nothing was
 * lost. One action: a phone number is the whole of Wave's sign-in, for a new
 * account and a returning one alike, so there is no "sign up / log in" fork to
 * choose between. After the code, the app comes straight back to `target`.
 */
export function GuestAccountSheet({
  target,
  onClose,
}: {
  target: ResumeTarget | null;
  onClose: () => void;
}) {
  const beginSignupFromGuest = useAuthStore((s) => s.beginSignupFromGuest);
  return (
    <Sheet
      visible={!!target}
      onClose={onClose}
      title="One step to pay"
      footer={
        <Button
          label="Continue with phone number"
          onPress={() => {
            if (target) beginSignupFromGuest(target);
          }}
        />
      }
    >
      <Text className="font-sans text-body text-muted">Your basket is saved.</Text>
    </Sheet>
  );
}
