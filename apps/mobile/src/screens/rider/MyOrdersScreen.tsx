import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  Empty,
  Gutter,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Skeleton,
  StatusPill,
  Thumb,
} from "../../components/v6";
import { useMyDeliveries } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";
import { statusPill } from "../student/orderPresenters";
import type { OrderStatus } from "../../types";

const ACTIVE_STATUSES: OrderStatus[] = ["rider_assigned", "en_route", "at_checkpoint"];

export function MyOrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { data: orders, isLoading } = useMyDeliveries();

  const active = orders?.filter((o) => ACTIVE_STATUSES.includes(o.status)) ?? [];
  const past = orders?.filter((o) => !ACTIVE_STATUSES.includes(o.status)) ?? [];

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-6 pt-4">
          <PageTitle>My deliveries</PageTitle>
        </Gutter>

        {isLoading ? (
          <Gutter className="gap-2">
            <Skeleton height={64} radius={12} />
            <Skeleton height={64} radius={12} />
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
                  <Text className="font-sans-medium text-subheading text-ink">In progress</Text>
                </Gutter>
                <Gutter>
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
                </Gutter>
              </View>
            ) : null}

            {past.length > 0 ? (
              <View>
                <Gutter className="mb-3">
                  <Text className="font-sans-medium text-subheading text-ink">Done</Text>
                </Gutter>
                <Gutter>
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
                </Gutter>
              </View>
            ) : null}
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}
