import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  Button,
  CardGrid,
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
import { useLayout } from "../../hooks/useLayout";
import { useShops } from "../../lib/shops";
import { describeWave } from "../../lib/wave";
import { formatGhsCompact, isStandardRunDay } from "../../lib/pricing";
import { openShopMenu } from "../../lib/desktopNavigate";
import { DEFAULT_DELIVERY_FEE_GHS } from "@wave/shared";

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
  const { gutter, cardWidth, shopColumns, isDesktop } = useLayout();
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
        <Gutter className={isDesktop ? "pb-6 pt-2" : "pb-5"}>
          {isDesktop ? (
            <>
              <Text className="font-sans-bold text-heading text-ink">Where from?</Text>
              <Text className="mt-1 font-sans text-ui text-muted">
                Pick a shop on this Wave. We’ll buy exactly what’s on their menu.
              </Text>
            </>
          ) : (
            <PageTitle>Where from?</PageTitle>
          )}
        </Gutter>

        <Gutter className="mb-5">
          <View style={isDesktop ? { maxWidth: 480 } : undefined}>
            {/* Auto-focused only when arriving from Home's search capsule.
                That capsule reads as a text field and its placeholder names
                things to type ("Jollof, printing, airtime…"), but it is a
                Pressable that routes here — so without this the promise breaks:
                you tap a search box and land on a list with no keyboard
                (review 04-ux-design). Not focused on the other entry points,
                where the student came to browse and an unrequested keyboard
                covering half the grid is the wrong default. */}
            <Field
              label=""
              value={query}
              onChangeText={setQuery}
              autoFocus={params?.focusSearch === true}
              placeholder="Search shops, places, categories"
            />
          </View>
        </Gutter>

        {categories.length > 0 ? (
          isDesktop ? (
            <Gutter className="mb-6">
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
                {categories.map((c) => (
                  <Chip
                    key={c}
                    label={c.charAt(0).toUpperCase() + c.slice(1)}
                    selected={category === c}
                    onPress={() => setCategory(c)}
                  />
                ))}
              </View>
            </Gutter>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}
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
          )
        ) : null}

        {isLoading ? (
          <CardGrid>
            {Array.from({ length: Math.max(shopColumns, 2) }, (_, i) => (
              <SkeletonCard key={i} width={cardWidth} />
            ))}
          </CardGrid>
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
          <CardGrid>
            {results.map((shop) => (
              <PhotoCard
                key={shop.id}
                width={cardWidth}
                imageUrl={shop.logoUrl}
                title={shop.name}
                meta={shop.locationText ?? shop.category}
                priceLabel="from"
                priceValue={`${formatGhsCompact(DEFAULT_DELIVERY_FEE_GHS)} delivery`}
                badge={shop.isActive ? undefined : "Paused"}
                onPress={() =>
                  wave &&
                  openShopMenu(navigation, {
                    shopId: shop.id,
                    shopName: shop.name,
                    scheduledDate: wave.scheduledDate,
                    isSpecialOrder: wave.isSpecialOrder,
                  })
                }
              />
            ))}
          </CardGrid>
        )}

        {/* Always reachable, not only from the empty state — a student may
            see six shops and still not the one they want. */}
        {results.length > 0 && wave ? (
          <Gutter>
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
          </Gutter>
        ) : null}
      </ScreenBody>
    </Screen>
  );
}
