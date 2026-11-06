import { useState } from "react";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Field, Row, RowGroup, Sheet } from "./v6";
import { useApplyForBeta, useBetaApplication, useSendBetaFeedback } from "../lib/beta";
import { apiErrorMessage } from "../lib/apiError";
import { showToast } from "../store/toastStore";

/**
 * "Join the beta" on the profile screen, for students and riders.
 *
 * One row whose wording follows the application: an invitation, then a
 * waiting line, then — once approved — the way to send feedback, which is the
 * whole point of having testers. Staff decide on the admin's Beta page.
 */
export function BetaProgram() {
  const { data: application, isLoading } = useBetaApplication();
  const client = useQueryClient();
  const [applying, setApplying] = useState(false);
  const [giving, setGiving] = useState(false);

  if (isLoading) return null;

  const status = application?.status ?? null;
  const row =
    status === "approved"
      ? { title: "Send beta feedback", meta: "You're a beta tester. Tell us what breaks.", onPress: () => setGiving(true) }
      : status === "pending"
        ? { title: "Beta application sent", meta: "Waiting for the Wave team to review it", onPress: undefined }
        : status === "revoked"
          ? { title: "Beta access withdrawn", meta: application?.reviewNote ?? "Contact support if you think that's a mistake", onPress: undefined }
          : status === "rejected"
            ? { title: "Apply for the beta again", meta: application?.reviewNote ?? "Not this time — you can try again", onPress: () => setApplying(true) }
            : { title: "Join the beta", meta: "Try new features before everyone else", onPress: () => setApplying(true) };

  return (
    <>
      <View className="mt-6">
        <RowGroup>
          <Row title={row.title} meta={row.meta} onPress={row.onPress} chevron={!!row.onPress} />
        </RowGroup>
      </View>

      <ApplySheet
        visible={applying}
        onClose={() => setApplying(false)}
        onApplied={() => {
          setApplying(false);
          void client.invalidateQueries({ queryKey: ["features"] });
          showToast("Application sent. We'll let you know.", "success");
        }}
      />
      <FeedbackSheet visible={giving} onClose={() => setGiving(false)} />
    </>
  );
}

function ApplySheet({ visible, onClose, onApplied }: { visible: boolean; onClose: () => void; onApplied: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const apply = useApplyForBeta();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Join the Wave beta"
      footer={
        <Button
          label={apply.isPending ? "Sending…" : "Apply"}
          loading={apply.isPending}
          onPress={() => {
            setError(null);
            apply.mutate(reason, {
              onSuccess: () => {
                setReason("");
                onApplied();
              },
              onError: (err) => setError(apiErrorMessage(err, "Couldn't send your application. Try again.")),
            });
          }}
        />
      }
    >
      <Text className="mb-4 font-sans text-body text-muted">
        Beta testers see new features first, while they may still have rough edges. The Wave team reviews
        every application.
      </Text>
      <Field
        label="Why do you want in? (optional)"
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        placeholder="e.g. I order every Wave and want group orders"
        error={error}
      />
    </Sheet>
  );
}

function FeedbackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useSendBetaFeedback();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Beta feedback"
      footer={
        <Button
          label={send.isPending ? "Sending…" : "Send"}
          loading={send.isPending}
          disabled={message.trim().length < 3}
          onPress={() => {
            setError(null);
            send.mutate(
              {
                message: message.trim(),
                screen: "Profile",
                appVersion: Constants.expoConfig?.version ?? undefined,
              },
              {
                onSuccess: () => {
                  setMessage("");
                  onClose();
                  showToast("Thanks — the team reads every one.", "success");
                },
                onError: (err) => setError(apiErrorMessage(err, "Couldn't send. Try again.")),
              },
            );
          }}
        />
      }
    >
      <Field
        label="What happened, or what would make it better?"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={2000}
        error={error}
      />
    </Sheet>
  );
}
