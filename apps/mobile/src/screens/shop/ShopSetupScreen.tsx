import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  ActionBar,
  Button,
  Field,
  Gutter,
  Screen,
  ScreenBody,
  Sheet,
} from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useCreateShop } from "../../lib/shopOwner";
import { supabase } from "../../lib/supabase";

/**
 * The shop owner's half of onboarding.
 *
 * A shop owner is the one role that signs up owning nothing — the role decides
 * which navigator they land in, but `ShopNavigator`'s screens all act on "the
 * selected shop", and before this screen existed a self-registered owner had no
 * shop for them to act on and no way to make one. Shops were admin-created only.
 *
 * What they type here goes live to nobody. `POST /shops` leaves `isVerified`
 * false and the public routes filter on it, so the storefront is invisible until
 * an admin approves it. The copy says so plainly rather than implying the shop
 * is open for business.
 */
const CATEGORIES = [
  "Groceries",
  "Pharmacy",
  "Food",
  "Stationery",
  "Electronics",
  "Household",
  "Other",
];

export function ShopSetupScreen() {
  const createShop = useCreateShop();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!category) return;
    setError(null);
    try {
      await createShop.mutateAsync({
        name: name.trim(),
        category,
        locationText: locationText.trim() || undefined,
        phone: phone.trim() || undefined,
        description: description.trim() || undefined,
      });
      // No navigation: the gate in ShopNavigator routes on the shop list, which
      // the mutation invalidates.
    } catch {
      setError("Couldn't create your shop. Please try again.");
    }
  }

  return (
    <Screen>
      <ScreenBody bottomInset={16}>
        <Gutter className="pt-12">
          <Text className="mb-2 font-sans-bold text-heading text-ink">Add your shop</Text>
          <Text className="mb-10 font-sans text-body text-muted">
            An admin checks this before students can see you. Nothing here is public yet.
          </Text>

          <View className="mb-6">
            <Field
              label="Shop name"
              value={name}
              onChangeText={setName}
              placeholder="Berekuso Mini Mart"
            />
          </View>

          <Text className="mb-2 font-sans-medium text-body text-ink">Category</Text>
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            className="mb-6 flex-row items-center gap-3 rounded-card bg-surface px-4 py-3.5"
          >
            <Text
              className={`flex-1 font-sans text-body ${category ? "text-ink" : "text-muted"}`}
            >
              {category ?? "Choose a category"}
            </Text>
          </Pressable>

          <View className="mb-6">
            <Field
              label="Where you are"
              value={locationText}
              onChangeText={setLocationText}
              placeholder="Opposite the Berekuso junction"
              hint="Optional — helps a rider find you the first time."
            />
          </View>

          <View className="mb-6">
            <Field
              label="Shop phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="0201234567"
              hint="Optional — used if a rider needs to reach the shop."
              keyboardType="phone-pad"
            />
          </View>

          <View className="mb-6">
            <Field
              label="What you sell"
              value={description}
              onChangeText={setDescription}
              placeholder="Provisions, toiletries, drinks"
              hint="Optional — shown to students browsing shops."
            />
          </View>

          {error ? <Text className="mt-2 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          <Button
            label="Submit for approval"
            onPress={handleCreate}
            loading={createShop.isPending}
            disabled={name.trim().length < 1 || !category}
          />
          <Button label="Sign out" variant="ghost" onPress={() => void supabase.auth.signOut()} />
        </View>
      </ActionBar>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Category">
        <View className="gap-1">
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setCategory(c);
                setPicking(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c }}
              className={`flex-row items-center gap-3 rounded-card px-4 py-3.5 ${
                category === c ? "bg-lime-faint" : "bg-canvas"
              }`}
            >
              <Text className="flex-1 font-sans-medium text-body text-ink">{c}</Text>
              {category === c ? (
                <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
