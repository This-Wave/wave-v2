import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  CheckoutProgress,
  Chip,
  Empty,
  Field,
  Gutter,
  ListError,
  ListSkeleton,
  Screen,
  ScreenBody,
  TopBar,
  WaveContextBanner,
} from "../../components/v6";
import { MinusIcon, PlusIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useShopProducts } from "../../lib/products";
import { formatGhs } from "../../lib/pricing";
import { useLayout } from "../../hooks/useLayout";
import { MAX_ITEM_QUANTITY, MAX_ORDER_ITEMS } from "@wave/shared";
import type { Product } from "../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;
type Route = RouteProp<StudentStackParamList, "ShopMenu">;

/**
 * Pick what you want from the shop's actual menu.
 *
 * This replaces the free-text "Your list" box that used to be the only way to
 * order. That box had two costs the app was quietly paying: Wave never knew
 * what an order was worth until a runner was at the till, and a student could
 * write anything at all — including items the shop has never sold.
 *
 * Only `active` products are listed (see `useShopProducts`). An out-of-stock
 * item shown here is a basket that fails at checkout, which is worse than never
 * offering it.
 *
 * The free-text path still exists, but it has moved to where it is honest: a
 * shop Wave doesn't carry yet, reached by suggesting it. See `SuggestShopScreen`.
 */
export function ShopMenuScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { isDesktop, gutter } = useLayout();
  const { data: products, isLoading, isError, refetch } = useShopProducts(params.shopId);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      Array.from(
        new Set((products ?? []).map((p) => p.category).filter((c): c is string => !!c)),
      ).sort(),
    [products],
  );

  const visible = useMemo(
    () => (category ? (products ?? []).filter((p) => p.category === category) : products ?? []),
    [products, category],
  );

  const chosen = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, q]) => q > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [quantities],
  );

  const basketTotal = useMemo(
    () =>
      chosen.reduce((sum, line) => {
        const product = products?.find((p) => p.id === line.productId);
        return sum + Number(product?.price ?? 0) * line.quantity;
      }, 0),
    [chosen, products],
  );

  const atItemLimit = chosen.length >= MAX_ORDER_ITEMS;

  function setQuantity(productId: string, next: number) {
    setQuantities((prev) => {
      const clamped = Math.max(0, Math.min(MAX_ITEM_QUANTITY, next));
      if (clamped === 0) {
        const { [productId]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: clamped };
    });
  }

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={chosen.length > 0 ? 150 : 32}>
        <Gutter>
          <CheckoutProgress step={1} />
          <WaveContextBanner
            scheduledDate={params.scheduledDate}
            isSpecialOrder={params.isSpecialOrder}
          />
          <Text className="mb-1 font-sans-bold text-heading text-ink">{params.shopName}</Text>
          <Text className="mb-6 font-sans text-body text-muted">
            {isDesktop
              ? "Add items from the menu. We buy exactly this list."
              : "Tap to add what you want. We buy exactly this."}
          </Text>
        </Gutter>

        {categories.length > 0 ? (
          isDesktop ? (
            <Gutter className="mb-5">
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
              className="mb-5 grow-0"
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

        <Gutter>
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : isError ? (
            <ListError onRetry={() => void refetch()} />
          ) : visible.length === 0 ? (
            <Empty
              title="Nothing on the menu yet"
              body="This shop hasn't listed anything Wave can buy. Try another shop."
            />
          ) : (
            <View
              className={isDesktop ? "flex-row flex-wrap" : "gap-2"}
              style={isDesktop ? { gap: 12 } : undefined}
            >
              {visible.map((product) => (
                <View
                  key={product.id}
                  style={isDesktop ? { width: "48%" } : undefined}
                >
                  <MenuRow
                    product={product}
                    quantity={quantities[product.id] ?? 0}
                    canAdd={!atItemLimit || !!quantities[product.id]}
                    onChange={(next) => setQuantity(product.id, next)}
                  />
                </View>
              ))}
            </View>
          )}

          {chosen.length > 0 ? (
            <View className="mt-8" style={isDesktop ? { maxWidth: 520 } : undefined}>
              <Field
                label="Anything else your runner should know?"
                value={note}
                onChangeText={setNote}
                placeholder="No pepper. Call me if the small size is finished."
                multiline
                maxLength={500}
              />
            </View>
          ) : null}
        </Gutter>
      </ScreenBody>

      {chosen.length > 0 ? (
        <ActionBar>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-sans text-body text-muted">
              {chosen.reduce((n, l) => n + l.quantity, 0)} item
              {chosen.reduce((n, l) => n + l.quantity, 0) === 1 ? "" : "s"}
            </Text>
            <Text className="font-sans-medium text-ui text-ink">{formatGhs(basketTotal)}</Text>
          </View>
          <Button
            label="Continue"
            onPress={() =>
              navigation.navigate("DescribeOrder", {
                shopId: params.shopId,
                shopName: params.shopName,
                scheduledDate: params.scheduledDate,
                isSpecialOrder: params.isSpecialOrder,
                items: chosen,
                itemsPreview: chosen.map((line) => {
                  const product = products?.find((p) => p.id === line.productId);
                  return {
                    name: product?.name ?? "Item",
                    unitPrice: Number(product?.price ?? 0),
                    quantity: line.quantity,
                  };
                }),
                notes: note.trim() || undefined,
              })
            }
          />
        </ActionBar>
      ) : null}
    </Screen>
  );
}

function MenuRow({
  product,
  quantity,
  canAdd,
  onChange,
}: {
  product: Product;
  quantity: number;
  canAdd: boolean;
  onChange: (next: number) => void;
}) {
  const selected = quantity > 0;

  return (
    <View
      className={`flex-row items-center gap-3 rounded-card p-3 ${
        selected ? "bg-lime-faint" : "bg-surface"
      }`}
    >
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          className="h-14 w-14 rounded-input"
          resizeMode="cover"
        />
      ) : (
        <View className="h-14 w-14 rounded-input bg-canvas" />
      )}

      <View className="flex-1">
        <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
          {product.name}
        </Text>
        {product.description ? (
          <Text className="font-sans text-caption text-muted" numberOfLines={1}>
            {product.description}
          </Text>
        ) : null}
        <Text className="mt-0.5 font-sans-medium text-body text-ink">
          {formatGhs(Number(product.price))}
        </Text>
      </View>

      {selected ? (
        <View className="flex-row items-center gap-1">
          <StepperButton
            label={`Remove one ${product.name}`}
            onPress={() => onChange(quantity - 1)}
          >
            <MinusIcon size={14} color={colors.ink} />
          </StepperButton>
          <Text className="w-7 text-center font-sans-medium text-body text-ink">{quantity}</Text>
          <StepperButton
            label={`Add another ${product.name}`}
            disabled={quantity >= MAX_ITEM_QUANTITY}
            onPress={() => onChange(quantity + 1)}
          >
            <PlusIcon size={14} color={colors.ink} />
          </StepperButton>
        </View>
      ) : (
        <Pressable
          onPress={() => onChange(1)}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add ${product.name}`}
          accessibilityState={{ disabled: !canAdd }}
          className={`h-9 items-center justify-center rounded-pill px-4 ${
            canAdd ? "bg-lime active:bg-lime-600" : "bg-surface-muted"
          }`}
        >
          <Text className={`font-sans-medium text-body ${canAdd ? "text-ink" : "text-subtle"}`}>
            Add
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function StepperButton({
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
