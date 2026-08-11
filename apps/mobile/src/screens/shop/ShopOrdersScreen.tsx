import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ShopStackParamList } from "../../navigation/ShopNavigator";
import {
  Empty,
  Gutter,
  ListError,
  ListSkeleton,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  StatusPill,
  Thumb,
} from "../../components/v6";
import { ChevronRightIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useShopOrders } from "../../lib/shopOwner";
import { useLayout } from "../../hooks/useLayout";
import { openShopIncoming } from "../../lib/desktopNavigate";
import { formatGhs } from "../../lib/pricing";
import { statusPill } from "../student/orderPresenters";
import type { Order } from "../../types";

/**
 * Every order across every shop this owner holds — `GET /orders/shop` resolves
 * by owner, not by a single shop, so this list intentionally spans all of them.
 */
export function ShopOrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { data: orders, isLoading, isError, refetch, isRefetching } = useShopOrders();
  const { isDesktop } = useLayout();

  return (
    <Screen>
      <ScreenBody
        bottomInset={24}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      >
        <Gutter className={isDesktop ? "pb-8 pt-8" : "pb-6 pt-4"}>
          {isDesktop ? (
            <>
              <Text className="font-sans-bold text-heading text-ink">Orders</Text>
              <Text className="mt-1 font-sans text-ui text-muted">
                Every order across the shops you own.
              </Text>
            </>
          ) : (
            <PageTitle>Orders</PageTitle>
          )}
        </Gutter>

        <Gutter>
          {isLoading ? (
            <ListSkeleton rows={4} />
          ) : isError ? (
            <ListError onRetry={() => void refetch()} />
          ) : !orders || orders.length === 0 ? (
            <Empty title="Nothing yet" body="Orders placed with your shop collect here." />
          ) : isDesktop ? (
            <View className="overflow-hidden rounded-card bg-surface">
              <View className="flex-row border-b border-hairline px-5 py-3">
                <Text className="flex-[2] font-sans-semibold text-meta text-muted">STUDENT</Text>
                <Text className="flex-[2] font-sans-semibold text-meta text-muted">ITEMS</Text>
                <Text className="flex-1 font-sans-semibold text-meta text-muted">TOTAL</Text>
                <Text className="w-28 font-sans-semibold text-meta text-muted">STATUS</Text>
              </View>
              {orders.map((order, i) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  last={i === orders.length - 1}
                  onPress={() => openShopIncoming(navigation, order.id)}
                />
              ))}
            </View>
          ) : (
            <RowGroup>
              {orders.map((order) => (
                <Row
                  key={order.id}
                  title={order.student?.fullName ?? "Student"}
                  meta={`${order.itemDescription} · ${formatGhs(Number(order.totalAmount))}`}
                  leading={<Thumb uri={order.shop?.logoUrl} />}
                  trailing={<StatusPill {...statusPill(order.status)} />}
                  onPress={() => openShopIncoming(navigation, order.id)}
                />
              ))}
            </RowGroup>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}

function OrderRow({
  order,
  last,
  onPress,
}: {
  order: Order;
  last: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View className="flex-[2] flex-row items-center gap-3 pr-3">
        <Thumb uri={order.shop?.logoUrl} size={40} />
        <Text className="flex-1 font-sans-medium text-body text-ink" numberOfLines={1}>
          {order.student?.fullName ?? "Student"}
        </Text>
      </View>
      <Text className="flex-[2] pr-3 font-sans text-body text-muted" numberOfLines={1}>
        {order.itemDescription}
      </Text>
      <Text className="flex-1 font-sans-medium text-body text-ink">
        {formatGhs(Number(order.totalAmount))}
      </Text>
      <View className="w-28">
        <StatusPill {...statusPill(order.status)} />
      </View>
      {onPress ? <ChevronRightIcon size={18} color={colors.subtle} strokeWidth={2} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className={`flex-row items-center px-5 py-4 active:bg-canvas ${
          last ? "" : "border-b border-hairline"
        }`}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View className={`flex-row items-center px-5 py-4 ${last ? "" : "border-b border-hairline"}`}>
      {body}
    </View>
  );
}
