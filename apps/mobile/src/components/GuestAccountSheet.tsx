import { Text, View } from "react-native";
import { Button, Sheet } from "./v6";
import { useAuthStore, type ResumeTarget } from "../store/authStore";

/**
 * v7 canvas "One last step, Ama": a guest who has built a send is asked for a
 * number only at the point of paying, and told nothing they entered is lost.
 */
export function GuestAccountSheet({
  target,
  onClose,
}: {
  target: ResumeTarget | null;
  onClose: () => void;
}) {
  const beginSignupFromGuest = useAuthStore((s) => s.beginSignupFromGuest);
  const first = useAuthStore((s) => s.guestFirstName?.trim().split(/\s+/)[0]);
  return (
    <Sheet
      visible={!!target}
      onClose={onClose}
      title={first ? `One last step, ${first}` : "One last step"}
      footer={
        <View style={{ gap: 4 }}>
          <Button
            label="Continue with phone"
            onPress={() => {
              if (target) beginSignupFromGuest(target);
            }}
          />
          <Button label="Keep looking around" variant="quiet" onPress={onClose} />
        </View>
      }
    >
      <Text className="font-sans text-ui text-muted">
        Add your number to pay and get your code. Your package details are saved.
      </Text>
    </Sheet>
  );
}
