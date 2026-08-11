import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RIDER_ID_TYPES } from "@wave/shared";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  ActionBar,
  Button,
  Chip,
  Field,
  Gutter,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { CameraIcon, CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import {
  useSubmitVerification,
  useUploadVerificationImage,
  useVerificationStatus,
} from "../../lib/rider";

type IdType = (typeof RIDER_ID_TYPES)[number];

const ID_TYPE_LABELS: Record<IdType, string> = {
  ghana_card: "Ghana Card",
  student_id: "Student ID",
  passport: "Passport",
};

function contentTypeFor(uri: string): "image/jpeg" | "image/png" | "image/webp" {
  if (uri.endsWith(".png")) return "image/png";
  if (uri.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function SubmitVerificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { data: existing } = useVerificationStatus();
  const uploadImage = useUploadVerificationImage();
  const submitVerification = useSubmitVerification();

  const [idType, setIdType] = useState<IdType>("ghana_card");
  const [idNumber, setIdNumber] = useState("");
  const [idPhoto, setIdPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [selfie, setSelfie] = useState<{ uri: string; base64: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function pickIdPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setIdPhoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  async function takeSelfie() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setSelfie({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  async function handleSubmit() {
    if (!idPhoto || !selfie || !idNumber.trim()) return;
    setError(null);
    try {
      const [idImagePath, selfiePath] = await Promise.all([
        uploadImage.mutateAsync({
          kind: "id",
          base64: idPhoto.base64,
          contentType: contentTypeFor(idPhoto.uri),
        }),
        uploadImage.mutateAsync({
          kind: "selfie",
          base64: selfie.base64,
          contentType: contentTypeFor(selfie.uri),
        }),
      ]);
      await submitVerification.mutateAsync({
        idType,
        idNumber: idNumber.trim(),
        idImagePath,
        selfiePath,
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong submitting your verification. Please try again.");
    }
  }

  const isSubmitting = uploadImage.isPending || submitVerification.isPending;
  const canSubmit = !!idPhoto && !!selfie && idNumber.trim().length > 0 && !isSubmitting;

  if (submitted) {
    return (
      <Screen narrow>
        <ScreenBody bottomInset={16}>
          <Gutter className="pt-12">
            <View className="mb-6 h-14 w-14 items-center justify-center rounded-pill bg-lime">
              <CheckIcon size={28} color={colors.ink} strokeWidth={2.4} />
            </View>
            <Text className="mb-2 font-sans-bold text-heading text-ink">Sent for review</Text>
            <Text className="font-sans text-body text-muted">
              Wave will check your ID and selfie. You'll get a notification once it's approved, and
              you can start taking orders straight away.
            </Text>
          </Gutter>
        </ScreenBody>
        <ActionBar>
          <Button label="Back to profile" onPress={() => navigation.goBack()} />
        </ActionBar>
      </Screen>
    );
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <Text className="mb-2 font-sans-bold text-heading text-ink">Verify yourself</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            Wave checks every rider before they carry a student's order. This takes a minute.
          </Text>

          {existing?.status === "rejected" ? (
            <View className="mb-7 rounded-card bg-danger-bg p-4">
              <Text className="font-sans text-body text-danger">
                Your last submission was turned down
                {existing.rejectionReason ? `: ${existing.rejectionReason}` : "."} Send clearer
                photos below.
              </Text>
            </View>
          ) : null}

          <Text className="mb-2 font-sans-medium text-body text-ink">Which ID?</Text>
          <View className="mb-7 flex-row flex-wrap gap-2">
            {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((type) => (
              <Chip
                key={type}
                label={ID_TYPE_LABELS[type]}
                selected={idType === type}
                onPress={() => setIdType(type)}
              />
            ))}
          </View>

          <View className="mb-7">
            <Field
              label="ID number"
              value={idNumber}
              onChangeText={setIdNumber}
              placeholder="GHA-123456789-0"
            />
          </View>

          <Text className="mb-2 font-sans-medium text-body text-ink">Photo of your ID</Text>
          <PhotoSlot
            uri={idPhoto?.uri}
            hint="Tap to choose a photo of your ID"
            onPress={pickIdPhoto}
          />

          <Text className="mb-2 mt-7 font-sans-medium text-body text-ink">A selfie</Text>
          <PhotoSlot uri={selfie?.uri} hint="Tap to take a selfie" onPress={takeSelfie} />

          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Send for review"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        />
      </ActionBar>
    </Screen>
  );
}

function PhotoSlot({
  uri,
  hint,
  onPress,
}: {
  uri?: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="h-40 items-center justify-center overflow-hidden rounded-card bg-surface-muted"
    >
      {uri ? (
        <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <>
          <CameraIcon size={22} color={colors.muted} strokeWidth={1.7} />
          <Text className="mt-2 font-sans text-body text-muted">{hint}</Text>
        </>
      )}
    </Pressable>
  );
}
