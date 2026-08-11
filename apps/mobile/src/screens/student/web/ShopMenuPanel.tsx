import { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../../navigation/StudentNavigator";
import { Button } from "../../../components/v6/Button";
import { RightPanel } from "../../../components/v6/RightPanel";
import { MinusIcon, PlusIcon } from "../../../components/icons";
import { colors } from "../../../theme/tokens";
import { useShopProducts } from "../../../lib/products";
import { formatGhs } from "../../../lib/pricing";
import { MAX_ITEM_QUANTITY, MAX_ORDER_ITEMS } from "@wave/shared";
import type { Product } from "../../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

/** Desktop right-rail menu — stays on Home while picking items. */
export function ShopMenuPanel({
  shopId,
  shopName,
  scheduledDate,
  isSpecialOrder,
  onClose,
}: {
  shopId: string;
  shopName: string;
  scheduledDate: string;
  isSpecialOrder: boolean;
  onClose: () => void;
}) {
  const navigation = useNavigation<Nav>();
  const { data: products, isLoading } = useShopProducts(shopId);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

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
    <RightPanel
      title={shopName}
      onClose={onClose}
      footer={
        chosen.length > 0 ? (
          <View>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-sans text-body text-muted">
                {chosen.reduce((n, l) => n + l.quantity, 0)} items
              </Text>
              <Text className="font-sans-medium text-ui text-ink">{formatGhs(basketTotal)}</Text>
            </View>
            <Button
              label="Continue"
              onPress={() => {
                onClose();
                navigation.navigate("DescribeOrder", {
                  shopId,
                  shopName,
                  scheduledDate,
                  isSpecialOrder,
                  items: chosen,
                  itemsPreview: chosen.map((line) => {
                    const product = products?.find((p) => p.id === line.productId);
                    return {
                      name: product?.name ?? "Item",
                      unitPrice: Number(product?.price ?? 0),
                      quantity: line.quantity,
                    };
                  }),
                });
              }}
            />
          </View>
        ) : undefined
      }
    >
      <Text className="mb-4 font-sans text-body text-muted">
        Add what you want. We buy exactly this list.
      </Text>
      {isLoading ? (
        <Text className="font-sans text-body text-muted">Loading menu…</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {(products ?? []).map((product) => (
            <MenuLine
              key={product.id}
              product={product}
              quantity={quantities[product.id] ?? 0}
              canAdd={!atItemLimit || !!quantities[product.id]}
              onChange={(next) => setQuantity(product.id, next)}
            />
          ))}
        </View>
      )}
    </RightPanel>
  );
}

function MenuLine({
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
        selected ? "bg-lime-faint" : "bg-canvas"
      }`}
    >
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          className="h-12 w-12 rounded-input"
          resizeMode="cover"
        />
      ) : (
        <View className="h-12 w-12 rounded-input bg-surface-muted" />
      )}
      <View className="flex-1">
        <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="font-sans-medium text-body text-ink">{formatGhs(Number(product.price))}</Text>
      </View>
      {selected ? (
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => onChange(quantity - 1)}
            className="h-8 w-8 items-center justify-center rounded-pill bg-surface"
          >
            <MinusIcon size={14} color={colors.ink} />
          </Pressable>
          <Text className="w-6 text-center font-sans-medium text-body text-ink">{quantity}</Text>
          <Pressable
            onPress={() => onChange(quantity + 1)}
            disabled={quantity >= MAX_ITEM_QUANTITY}
            className="h-8 w-8 items-center justify-center rounded-pill bg-surface"
          >
            <PlusIcon size={14} color={colors.ink} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => onChange(1)}
          disabled={!canAdd}
          className={`h-9 items-center justify-center rounded-pill px-3 ${
            canAdd ? "bg-lime" : "bg-surface-muted"
          }`}
        >
          <Text className="font-sans-medium text-body text-ink">Add</Text>
        </Pressable>
      )}
    </View>
  );
}
