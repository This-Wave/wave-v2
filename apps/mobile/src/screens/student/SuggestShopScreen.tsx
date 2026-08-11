import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Field,
  Gutter,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { MinusIcon, PlusIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useSuggestShop } from "../../lib/suggestions";
import { MAX_ITEM_QUANTITY, MAX_ORDER_ITEMS } from "@wave/shared";

type Nav = NativeStackNavigationProp<StudentStackParamList>;
type Route = RouteProp<StudentStackParamList, "SuggestShop">;

interface Draft {
  name: string;
  quantity: number;
}

/**
 * "You don't have the shop I need."
 *
 * This is the **only** place in the app where a student types item names by
 * hand, and that restriction is the point. Everywhere else the shop's catalogue
 * supplies the names and the prices; here there is no catalogue, because Wave
 * has no relationship with the shop yet.
 *
 * Two things happen at once when this is submitted:
 *  1. A demand signal. Admin ranks suggested places by how many students asked,
 *     and that ranking decides which shop gets onboarded next.
 *  2. A real order, if they want one — a `shop_pickup`. The runner goes, buys
 *     the list, records what it actually cost, and the goods are charged then.
 *     Nobody can quote a price up front because nobody knows one.
 */
export function SuggestShopScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const suggest = useSuggestShop();

  const [name, setName] = useState(params?.initialQuery ?? "");
  const [locationText, setLocationText] = useState("");
  const [items, setItems] = useState<Draft[]>([{ name: "", quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);

  const filled = items.filter((i) => i.name.trim().length > 0);
  const canSubmit = name.trim().length >= 2 && filled.length > 0;

  function updateItem(index: number, patch: Partial<Draft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit() {
    setError(null);
    try {
      const suggestion = await suggest.mutateAsync({
        name: name.trim(),
        locationText: locationText.trim() || undefined,
      });

      navigation.navigate("SuggestOrderSummary", {
        suggestionId: suggestion.id,
        shopName: suggestion.name,
        locationText: suggestion.locationText ?? undefined,
        scheduledDate: params.scheduledDate,
        isSpecialOrder: params.isSpecialOrder,
        manualItems: filled.map((i) => ({ name: i.name.trim(), quantity: i.quantity })),
      });
    } catch (err) {
      // 409 means the place is already on Wave — that is good news, not a
      // failure, and the student should be sent to the real shop instead.
      const status = (err as { response?: { status?: number; data?: { error?: string } } }).response;
      if (status?.status === 409) {
        setError(status.data?.error ?? "That shop is already on Wave — search for it by name.");
        return;
      }
      setError("Couldn't send that suggestion. Please try again.");
    }
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="mb-2 font-sans-bold text-heading text-ink">Can't find the shop?</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            Tell us where it is and what you need. We'll send a runner, and they'll tell you what it
            cost before you pay for the items. The more people ask for a place, the sooner it gets
            its own menu on Wave.
          </Text>

          <View className="mb-6">
            <Field
              label="Shop name"
              value={name}
              onChangeText={setName}
              placeholder="Melcom, Berekuso"
              maxLength={120}
            />
          </View>

          <View className="mb-8">
            <Field
              label="Where is it? (optional)"
              value={locationText}
              onChangeText={setLocationText}
              placeholder="Opposite the taxi rank on the Berekuso road"
              maxLength={200}
              multiline
            />
          </View>

          <Text className="mb-1 font-sans-medium text-body text-ink">What do you need?</Text>
          <Text className="mb-4 font-sans text-caption text-muted">
            Be specific — your runner buys exactly what you write, and they can't ask the shop what
            you meant.
          </Text>

          <View className="gap-2">
            {items.map((item, index) => (
              <View key={index} className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Field
                    label=""
                    value={item.name}
                    onChangeText={(text) => updateItem(index, { name: text })}
                    placeholder="Bag of rice, 5kg"
                    maxLength={120}
                  />
                </View>

                <View className="flex-row items-center gap-1">
                  <Stepper
                    label="Fewer"
                    disabled={item.quantity <= 1}
                    onPress={() => updateItem(index, { quantity: item.quantity - 1 })}
                  >
                    <MinusIcon size={14} color={colors.ink} />
                  </Stepper>
                  <Text className="w-6 text-center font-sans-medium text-body text-ink">
                    {item.quantity}
                  </Text>
                  <Stepper
                    label="More"
                    disabled={item.quantity >= MAX_ITEM_QUANTITY}
                    onPress={() => updateItem(index, { quantity: item.quantity + 1 })}
                  >
                    <PlusIcon size={14} color={colors.ink} />
                  </Stepper>
                </View>
              </View>
            ))}
          </View>

          {items.length < MAX_ORDER_ITEMS ? (
            <Pressable
              onPress={() => setItems((prev) => [...prev, { name: "", quantity: 1 }])}
              accessibilityRole="button"
              className="mt-3 self-start rounded-pill px-1 py-2"
            >
              <Text className="font-sans-medium text-body text-ink">+ Add another item</Text>
            </Pressable>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        {error ? <Text className="mb-3 font-sans text-body text-danger">{error}</Text> : null}
        <Button
          label="Continue"
          onPress={handleSubmit}
          loading={suggest.isPending}
          disabled={!canSubmit}
        />
      </ActionBar>
    </Screen>
  );
}

function Stepper({
  children,
  label,
  disabled,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      className={`h-8 w-8 items-center justify-center rounded-pill bg-surface ${
        disabled ? "opacity-40" : "active:bg-hairline"
      }`}
    >
      {children}
    </Pressable>
  );
}
