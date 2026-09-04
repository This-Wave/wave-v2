import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ALLOWED_ID_TYPES_BY_RIDER_TYPE, type RIDER_ID_TYPES } from "@wave/shared";
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
import { useAuthStore } from "../../store/authStore";
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

  // The rider's type decides which documents are acceptable — a student rider
  // proves the claim with a student ID, and an external rider may not use one,
  // since a student ID from a non-student identifies nobody. The API enforces
  // this; the form simply stops offering choices that would be rejected.
  const riderType = useAuthStore((state) => state.profile?.riderType) ?? "student";
  const allowedIdTypes = ALLOWED_ID_TYPES_BY_RIDER_TYPE[riderType] as readonly IdType[];
  const isExternal = riderType === "external";

  const [idType, setIdType] = useState<IdType>(allowedIdTypes[0] ?? "ghana_card");
  const [secondIdType, setSecondIdType] = useState<IdType>("passport");
  const [secondIdNumber, setSecondIdNumber] = useState("");
  const [secondIdPhoto, setSecondIdPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [addressPhoto, setAddressPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [referenceContact, setReferenceContact] = useState("");
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

  async function pickInto(setter: (v: { uri: string; base64: string }) => void) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setter({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
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
      // Uploaded only for an external rider; the API rejects a student's
      // submission that carries them rather than storing evidence nobody asked
      // for and nobody will check.
      const extras = isExternal
        ? {
            guarantorName: guarantorName.trim(),
            guarantorPhone: guarantorPhone.trim(),
            secondIdType,
            secondIdNumber: secondIdNumber.trim(),
            secondIdImagePath: await uploadImage.mutateAsync({
              kind: "second_id",
              base64: secondIdPhoto!.base64,
              contentType: contentTypeFor(secondIdPhoto!.uri),
            }),
            proofOfAddressPath: await uploadImage.mutateAsync({
              kind: "proof_of_address",
              base64: addressPhoto!.base64,
              contentType: contentTypeFor(addressPhoto!.uri),
            }),
            referenceName: referenceName.trim(),
            referenceContact: referenceContact.trim(),
          }
        : {};

      await submitVerification.mutateAsync({
        idType,
        idNumber: idNumber.trim(),
        idImagePath,
        selfiePath,
        ...extras,
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong submitting your verification. Please try again.");
    }
  }

  const isSubmitting = uploadImage.isPending || submitVerification.isPending;
  const externalComplete =
    !isExternal ||
    (!!secondIdPhoto &&
      !!addressPhoto &&
      secondIdNumber.trim().length > 0 &&
      guarantorName.trim().length > 1 &&
      guarantorPhone.trim().length > 8 &&
      referenceName.trim().length > 1 &&
      referenceContact.trim().length > 4);
  const canSubmit =
    !!idPhoto && !!selfie && idNumber.trim().length > 0 && externalComplete && !isSubmitting;

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
            {allowedIdTypes.map((type) => (
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

          {isExternal ? (
            <>
              <View className="mt-9 mb-2">
                <Text className="font-sans-bold text-heading-sm text-ink">A few more things</Text>
                <Text className="mt-1 font-sans text-body text-muted">
                  Riders who aren't students of the university are asked for more, because there's
                  no campus record of you to check against.
                </Text>
              </View>

              <Text className="mb-2 mt-5 font-sans-medium text-body text-ink">A second ID</Text>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {(Object.keys(ID_TYPE_LABELS) as IdType[])
                  .filter((type) => type !== idType && type !== "student_id")
                  .map((type) => (
                    <Chip
                      key={type}
                      label={ID_TYPE_LABELS[type]}
                      selected={secondIdType === type}
                      onPress={() => setSecondIdType(type)}
                    />
                  ))}
              </View>
              <View className="mb-4">
                <Field
                  label="Second ID number"
                  value={secondIdNumber}
                  onChangeText={setSecondIdNumber}
                  placeholder="G0123456"
                />
              </View>
              <PhotoSlot
                uri={secondIdPhoto?.uri}
                hint="Tap to choose a photo of your second ID"
                onPress={() => pickInto(setSecondIdPhoto)}
              />

              <Text className="mb-2 mt-7 font-sans-medium text-body text-ink">Proof of address</Text>
              <PhotoSlot
                uri={addressPhoto?.uri}
                hint="A bill, tenancy note or letter showing where you live"
                onPress={() => pickInto(setAddressPhoto)}
              />

              <View className="mt-7 mb-4">
                <Field
                  label="Guarantor's name"
                  value={guarantorName}
                  onChangeText={setGuarantorName}
                  placeholder="Someone who vouches for you"
                />
              </View>
              <View className="mb-4">
                <Field
                  label="Guarantor's phone"
                  value={guarantorPhone}
                  onChangeText={setGuarantorPhone}
                  placeholder="0201234567"
                  keyboardType="phone-pad"
                />
              </View>
              <View className="mb-4">
                <Field
                  label="Reference on campus"
                  value={referenceName}
                  onChangeText={setReferenceName}
                  placeholder="A staff member or student who knows you"
                />
              </View>
              <View className="mb-2">
                <Field
                  label="How to reach them"
                  value={referenceContact}
                  onChangeText={setReferenceContact}
                  placeholder="Phone or email"
                />
              </View>
            </>
          ) : null}

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
