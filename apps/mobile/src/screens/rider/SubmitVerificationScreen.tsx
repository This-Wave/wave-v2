import { useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Camera, IdCard, ShieldCheck } from "lucide-react-native";
import type { RIDER_ID_TYPES } from "@wave/shared";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { FilterChip } from "../../components/ui/FilterChip";
import { useSubmitVerification, useUploadVerificationImage, useVerificationStatus } from "../../lib/rider";

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
        uploadImage.mutateAsync({ kind: "id", base64: idPhoto.base64, contentType: contentTypeFor(idPhoto.uri) }),
        uploadImage.mutateAsync({ kind: "selfie", base64: selfie.base64, contentType: contentTypeFor(selfie.uri) }),
      ]);
      await submitVerification.mutateAsync({ idType, idNumber: idNumber.trim(), idImagePath, selfiePath });
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
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-success-bg">
            <ShieldCheck size={30} color="#009933" strokeWidth={1.6} />
          </View>
          <Text className="mb-2 text-center font-sans-extrabold text-[20px] text-ink">Submitted for review</Text>
          <Text className="mb-8 text-center text-[13px] leading-5 text-muted">
            We'll notify you once an admin reviews your ID and selfie.
          </Text>
          <Button label="Back to Profile" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center gap-3 px-6 pb-3.5 pt-1.5">
        <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} compact />
        <Text className="flex-1 font-sans-extrabold text-[16px] tracking-tight text-ink">Rider Verification</Text>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        {existing?.status === "rejected" ? (
          <View className="rounded-well border border-danger-border bg-danger-bg p-3">
            <Text className="text-[12px] text-danger-text">
              Your previous submission was rejected{existing.rejectionReason ? `: ${existing.rejectionReason}` : "."} Please resubmit below.
            </Text>
          </View>
        ) : null}

        <View>
          <Text className="mb-1.5 font-sans-semibold text-xs text-text-secondary">ID Type</Text>
          <View className="flex-row gap-2">
            {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((type) => (
              <FilterChip key={type} label={ID_TYPE_LABELS[type]} active={idType === type} onPress={() => setIdType(type)} />
            ))}
          </View>
        </View>

        <TextField label="ID Number" value={idNumber} onChangeText={setIdNumber} placeholder="e.g. GHA-123456789-0" mono />

        <View>
          <Text className="mb-1.5 font-sans-semibold text-xs text-text-secondary">ID Photo</Text>
          <Pressable
            onPress={pickIdPhoto}
            className="h-[140px] items-center justify-center overflow-hidden rounded-well border-[1.5px] border-border bg-surface-muted"
          >
            {idPhoto ? (
              <Image source={{ uri: idPhoto.uri }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <>
                <IdCard size={22} color="#6B7D63" />
                <Text className="mt-1.5 text-[12px] text-muted">Tap to upload a photo of your ID</Text>
              </>
            )}
          </Pressable>
        </View>

        <View>
          <Text className="mb-1.5 font-sans-semibold text-xs text-text-secondary">Selfie</Text>
          <Pressable
            onPress={takeSelfie}
            className="h-[140px] items-center justify-center overflow-hidden rounded-well border-[1.5px] border-border bg-surface-muted"
          >
            {selfie ? (
              <Image source={{ uri: selfie.uri }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <>
                <Camera size={22} color="#6B7D63" />
                <Text className="mt-1.5 text-[12px] text-muted">Tap to take a selfie</Text>
              </>
            )}
          </Pressable>
        </View>

        {error ? <Text className="text-center text-[12px] text-danger-text">{error}</Text> : null}
      </ScrollView>

      <View className="px-6 pb-6 pt-3">
        <Button label="Submit for Review" onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
      </View>
    </SafeAreaView>
  );
}
