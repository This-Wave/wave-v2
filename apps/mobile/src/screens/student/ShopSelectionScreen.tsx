import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
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

type Nav = NativeStackNavigationProp<StudentStackParamList>;

/**
 * Browse shops. A two-up photo grid rather than v5's list of bordered rows —
 * the reference's whole argument is that photography carries a browse surface,
 * and a shop logo at 44px in a list row communicates nothing.
 */
export function ShopSelectionScreen() {
  const navigation = useNavigation<Nav>();
  const { data: shops, isLoading } = useShops();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

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
            <Empty title="No shops match" body="Try a different word, or clear the filter." />
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
                    navigation.navigate("DescribeOrder", { shopId: shop.id, shopName: shop.name })
                  }
                />
              ))}
            </View>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
