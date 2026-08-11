import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
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
import { useMyDeliveries } from "../../lib/rider";
import { useLayout } from "../../hooks/useLayout";
import { formatGhs } from "../../lib/pricing";
import { statusPill } from "../student/orderPresenters";
import type { Order, OrderStatus } from "../../types";

const ACTIVE_STATUSES: OrderStatus[] = ["rider_assigned", "en_route", "at_checkpoint"];

export function MyOrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { data: orders, isLoading, isError, refetch, isRefetching } = useMyDeliveries();
  const { isDesktop } = useLayout();

  const active = orders?.filter((o) => ACTIVE_STATUSES.includes(o.status)) ?? [];
  const past = orders?.filter((o) => !ACTIVE_STATUSES.includes(o.status)) ?? [];

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
              <Text className="font-sans-bold text-heading text-ink">Deliveries</Text>
              <Text className="mt-1 font-sans text-ui text-muted">
                Active runs and what you’ve already handed over.
              </Text>
            </>
          ) : (
            <PageTitle>My deliveries</PageTitle>
          )}
        </Gutter>

        {isLoading ? (
          <Gutter>
            <ListSkeleton rows={3} />
          </Gutter>
        ) : isError ? (
          <Gutter>
            <ListError onRetry={() => void refetch()} />
          </Gutter>
        ) : !orders || orders.length === 0 ? (
          <Empty
            title="Nothing yet"
            body="Accept an order from the Feed and it'll appear here."
          />
        ) : (
          <>
            {active.length > 0 ? (
              <View className="mb-section">
                <Gutter className="mb-3">
                  <Text className="font-sans-medium text-heading-sm text-ink">In progress</Text>
                </Gutter>
                <Gutter style={isDesktop ? { gap: 12 } : undefined}>
                  {isDesktop
                    ? active.map((order) => (
                        <Pressable
                          key={order.id}
                          onPress={() =>
                            navigation.navigate("ActiveDelivery", { orderId: order.id })
                          }
                          className="flex-row items-center gap-4 rounded-card bg-surface px-5 py-4 active:bg-hairline"
                        >
                          <Thumb uri={order.shop?.logoUrl} size={52} />
                          <View className="min-w-0 flex-1">
                            <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
                              {order.shop?.name ?? "Delivery"}
                            </Text>
                            <Text className="mt-1 font-sans text-body text-muted" numberOfLines={1}>
                              To {order.checkpoint?.name ?? "checkpoint"}
                            </Text>
                          </View>
                          <StatusPill {...statusPill(order.status)} />
                          <Text className="font-sans-medium text-body text-ink">Open →</Text>
                        </Pressable>
                      ))
                    : (
                        <RowGroup>
                          {active.map((order) => (
                            <Row
                              key={order.id}
                              title={order.shop?.name ?? "Delivery"}
                              meta={`To ${order.checkpoint?.name ?? "checkpoint"}`}
                              leading={<Thumb uri={order.shop?.logoUrl} />}
                              trailing={<StatusPill {...statusPill(order.status)} />}
                              onPress={() =>
                                navigation.navigate("ActiveDelivery", { orderId: order.id })
                              }
                            />
                          ))}
                        </RowGroup>
                      )}
                </Gutter>
              </View>
            ) : null}

            {past.length > 0 ? (
              <View>
                <Gutter className="mb-3">
                  <Text className="font-sans-medium text-heading-sm text-ink">Done</Text>
                </Gutter>
                <Gutter>
                  {isDesktop ? (
                    <View className="overflow-hidden rounded-card bg-surface">
                      <View className="flex-row border-b border-hairline px-5 py-3">
                        <Text className="flex-[2] font-sans-semibold text-meta text-muted">
                          SHOP
                        </Text>
                        <Text className="flex-1 font-sans-semibold text-meta text-muted">DATE</Text>
                        <Text className="w-28 font-sans-semibold text-meta text-muted">FEE</Text>
                      </View>
                      {past.map((order, i) => (
                        <PastRow key={order.id} order={order} last={i === past.length - 1} />
                      ))}
                    </View>
                  ) : (
                    <RowGroup>
                      {past.map((order) => (
                        <Row
                          key={order.id}
                          title={order.shop?.name ?? "Delivery"}
                          meta={new Date(order.createdAt).toLocaleDateString([], {
                            day: "numeric",
                            month: "short",
                          })}
                          leading={<Thumb uri={order.shop?.logoUrl} />}
                          chevron={false}
                          trailing={
                            <Text className="font-sans-semibold text-body text-ink">
                              {formatGhs(Number(order.deliveryFee))}
                            </Text>
                          }
                        />
                      ))}
                    </RowGroup>
                  )}
                </Gutter>
              </View>
            ) : null}
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}

function PastRow({ order, last }: { order: Order; last: boolean }) {
  return (
    <View
      className={`flex-row items-center px-5 py-4 ${last ? "" : "border-b border-hairline"}`}
    >
      <View className="flex-[2] flex-row items-center gap-3 pr-3">
        <Thumb uri={order.shop?.logoUrl} size={40} />
        <Text className="flex-1 font-sans-medium text-body text-ink" numberOfLines={1}>
          {order.shop?.name ?? "Delivery"}
        </Text>
      </View>
      <Text className="flex-1 font-sans text-body text-muted">
        {new Date(order.createdAt).toLocaleDateString([], {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </Text>
      <Text className="w-28 font-sans-semibold text-body text-ink">
        {formatGhs(Number(order.deliveryFee))}
      </Text>
    </View>
  );
}
