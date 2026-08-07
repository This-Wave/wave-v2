import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  Button,
  Chip,
  Empty,
  Gutter,
  PageTitle,
  PhotoCard,
  Screen,
  ScreenBody,
  SkeletonCard,
  TopBar,
} from "../../components/v6";
import { Field } from "../../components/v6";
import { useShops } from "../../lib/shops";
import { describeWave } from "../../lib/wave";
import { isStandardRunDay } from "../../lib/pricing";

type Nav = NativeStackNavigationProp<StudentStackParamList>;
type Route = RouteProp<StudentStackParamList, "ShopSelection">;

/**
 * Browse shops. A two-up photo grid rather than v5's list of bordered rows —
 * the reference's whole argument is that photography carries a browse surface,
 * and a shop logo at 44px in a list row communicates nothing.
 */
export function ShopSelectionScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { data: shops, isLoading } = useShops();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  /**
   * Entering from Home's "Buy for me" tile skips the calendar, so no Wave has
   * been chosen. Falling back to the next open one keeps that shortcut working
   * — the student can still change the day from the calendar entry point.
   */
  const wave = useMemo(() => {
    if (params?.scheduledDate) {
      return { scheduledDate: params.scheduledDate, isSpecialOrder: params.isSpecialOrder };
    }
    const next = describeWave();
    if (!next) return null;
    return {
      scheduledDate: next.date.toISOString(),
      isSpecialOrder: !isStandardRunDay(next.date),
    };
  }, [params?.scheduledDate, params?.isSpecialOrder]);

  const categories = useMemo(
    () => Array.from(new Set((shops ?? []).map((s) => s.category).filter(Boolean))).sort(),
    [shops],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (shops ?? []).filter((s) => {
      if (category && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.locationText ?? "").toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [shops, query, category]);

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={32}>
        <Gutter className="pb-5">
          <PageTitle>Where from?</PageTitle>
        </Gutter>

        <Gutter className="mb-5">
          <Field
            label=""
            value={query}
            onChangeText={setQuery}
            placeholder="Search shops, places, categories"
          />
        </Gutter>

        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
            className="mb-6 grow-0"
          >
            <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
            {categories.map((c) => (
              <Chip
                key={c}
                label={c.charAt(0).toUpperCase() + c.slice(1)}
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </ScrollView>
        ) : null}

        <Gutter>
          {isLoading ? (
            <View className="flex-row flex-wrap justify-between gap-y-6">
              <SkeletonCard width={160} />
              <SkeletonCard width={160} />
            </View>
          ) : results.length === 0 ? (
            <Empty
              title={query.trim() ? `No shop called "${query.trim()}"` : "No shops match"}
              body={
                query.trim()
                  ? "Wave might not carry it yet. Tell us where it is and we'll send a runner — and the more people ask, the sooner it gets its own menu."
                  : "Try a different word, or clear the filter."
              }
              action={
                query.trim() && wave ? (
                  <Button
                    label={`Suggest ${query.trim()}`}
                    onPress={() =>
                      navigation.navigate("SuggestShop", {
                        initialQuery: query.trim(),
                        scheduledDate: wave.scheduledDate,
                        isSpecialOrder: wave.isSpecialOrder,
                      })
                    }
                  />
                ) : undefined
              }
            />
          ) : (
            <View className="flex-row flex-wrap justify-between gap-y-6">
              {results.map((shop) => (
                <PhotoCard
                  key={shop.id}
                  width={160}
                  imageUrl={shop.logoUrl}
                  title={shop.name}
                  meta={shop.locationText ?? shop.category}
                  priceLabel="from"
                  priceValue="GH₵5 delivery"
                  badge={shop.isActive ? undefined : "Paused"}
                  onPress={() =>
                    wave &&
                    navigation.navigate("ShopMenu", {
                      shopId: shop.id,
                      shopName: shop.name,
                      scheduledDate: wave.scheduledDate,
                      isSpecialOrder: wave.isSpecialOrder,
                    })
                  }
                />
              ))}
            </View>
          )}

          {/* Always reachable, not only from the empty state — a student may
              see six shops and still not the one they want. */}
          {results.length > 0 && wave ? (
            <Pressable
              onPress={() =>
                navigation.navigate("SuggestShop", {
                  initialQuery: query.trim() || undefined,
                  scheduledDate: wave.scheduledDate,
                  isSpecialOrder: wave.isSpecialOrder,
                })
              }
              accessibilityRole="button"
              className="mt-8 rounded-card bg-surface p-4 active:bg-hairline"
            >
              <Text className="font-sans-medium text-body text-ink">
                Can’t find the shop you want?
              </Text>
              <Text className="mt-1 font-sans text-body text-muted">
                Suggest it and we’ll send a runner anyway.
              </Text>
            </Pressable>
          ) : null}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
