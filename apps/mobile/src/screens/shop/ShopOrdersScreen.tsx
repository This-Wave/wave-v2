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
import { View } from "react-native";
import { useShopOrders } from "../../lib/shopOwner";
import { formatGhs } from "../../lib/pricing";
import { statusPill } from "../student/orderPresenters";

/**
 * Every order across every shop this owner holds — `GET /orders/shop` resolves
 * by owner, not by a single shop, so this list intentionally spans all of them.
 */
export function ShopOrdersScreen() {
  const { data: orders, isLoading } = useShopOrders();

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-6 pt-4">
          <PageTitle>Orders</PageTitle>
        </Gutter>

        <Gutter>
          {isLoading ? (
            <View className="gap-2">
              <Skeleton height={64} radius={12} />
              <Skeleton height={64} radius={12} />
            </View>
          ) : !orders || orders.length === 0 ? (
            <Empty title="Nothing yet" body="Orders placed with your shop collect here." />
          ) : (
            <RowGroup>
              {orders.map((order) => (
                <Row
                  key={order.id}
                  title={order.student?.fullName ?? "Student"}
                  meta={`${order.itemDescription} · ${formatGhs(Number(order.totalAmount))}`}
                  leading={<Thumb uri={order.shop?.logoUrl} />}
                  chevron={false}
                  trailing={<StatusPill {...statusPill(order.status)} />}
                />
              ))}
            </RowGroup>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
