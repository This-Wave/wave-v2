import { useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RIDER_ID_TYPES } from "@wave/shared";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { FieldLabel } from "../../components/ui/FieldLabel";
import { FilterChip } from "../../components/ui/FilterChip";
import { AlertIcon, CameraIcon, CardIcon, ShieldCheckIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
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

function UploadWell({
  uri,
  icon,
  prompt,
  onPress,
}: {
  uri?: string;
  icon: React.ReactNode;
  prompt: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-[150px] items-center justify-center gap-2.5 overflow-hidden rounded-card border-[1.5px] border-border bg-surface"
    >
      {uri ? (
        <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <>
          {icon}
          <Text className="text-[13px] text-muted">{prompt}</Text>
        </>
      )}
    </Pressable>
  );
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
      const [idImageUrl, selfieUrl] = await Promise.all([
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
        idImageUrl,
        selfieUrl,
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
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-[18px] h-[72px] w-[72px] items-center justify-center rounded-full bg-wave-lime">
            <ShieldCheckIcon size={32} color={colors.primary} strokeWidth={1.6} />
          </View>
          <Text className="mb-2.5 text-center font-sans-semibold text-[24px] tracking-tight text-ink">
            Submitted for review
          </Text>
          <Text className="mb-8 text-center text-[14px] leading-[22px] text-muted">
            We&apos;ll notify you once an admin reviews your ID and selfie.
          </Text>
          <View className="w-full">
            <Button label="Back to profile" onPress={() => navigation.goBack()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Rider verification" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
        {existing?.status === "rejected" ? (
          <View className="mb-5 rounded-control border border-danger-border bg-danger-bg p-3.5">
            <Text className="text-[12px] leading-[19px] text-danger-text">
              Your previous submission was rejected
              {existing.rejectionReason ? `: ${existing.rejectionReason}` : "."} Please resubmit below.
            </Text>
          </View>
        ) : null}

        <FieldLabel>ID type</FieldLabel>
        <View className="mb-6 flex-row gap-2">
          {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((type) => (
            <FilterChip
              key={type}
              label={ID_TYPE_LABELS[type]}
              active={idType === type}
              onPress={() => setIdType(type)}
            />
          ))}
        </View>

        <View className="mb-6">
          <TextField
            label="ID number"
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="e.g. GHA-123456789-0"
          />
        </View>

        <FieldLabel>ID photo</FieldLabel>
        <View className="mb-6">
          <UploadWell
            uri={idPhoto?.uri}
            icon={<CardIcon size={26} color={colors.muted} strokeWidth={1.7} />}
            prompt="Tap to upload a photo of your ID"
            onPress={pickIdPhoto}
          />
        </View>

        <FieldLabel>Selfie</FieldLabel>
        <View className="mb-4">
          <UploadWell
            uri={selfie?.uri}
            icon={<CameraIcon size={26} color={colors.muted} strokeWidth={1.7} />}
            prompt="Tap to take a selfie"
            onPress={takeSelfie}
          />
        </View>

        <View
          className="flex-row gap-2.5 rounded-control border border-border bg-surface p-4"
          style={shadowCard}
        >
          <AlertIcon size={17} color={colors.muted} strokeWidth={1.7} />
          <Text className="flex-1 text-[12px] leading-[19px] text-muted">
            Your ID and selfie are stored privately and only ever shown to a Wave admin reviewing your
            application.
          </Text>
        </View>

        {error ? (
          <Text className="mt-4 text-center text-[12px] text-danger-text">{error}</Text>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-7 pt-3">
        <Button
          label="Submit for review"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        />
      </View>
    </SafeAreaView>
  );
}
