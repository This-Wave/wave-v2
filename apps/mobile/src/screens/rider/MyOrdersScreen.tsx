import { Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  BrandBar,
  Empty,
  Gutter,
  ListError,
  ListSkeleton,
  PageTitle,
  Screen,
  ScreenBody,
} from "../../components/v6";
import { OrderCardRow } from "../../components/v7/OrderCards";
import { useMyDeliveries } from "../../lib/rider";
import type { OrderStatus } from "../../types";

const ACTIVE_STATUSES: OrderStatus[] = ["rider_assigned", "en_route", "at_checkpoint"];

export function MyOrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { data: orders, isLoading, isError, refetch, isRefetching } = useMyDeliveries();

  const active = orders?.filter((o) => ACTIVE_STATUSES.includes(o.status)) ?? [];
  const past = orders?.filter((o) => !ACTIVE_STATUSES.includes(o.status)) ?? [];

  return (
    <Screen>
      <BrandBar />
      <ScreenBody
        bottomInset={24}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      >
        <Gutter className="pb-4 pt-6">
          <PageTitle>My jobs</PageTitle>
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
          <Empty title="Nothing yet" body="Accept a job and it shows up here." />
        ) : (
          // v7: the same card rows as the student's Orders list. No money on
          // these rows: the order carries the student's fee, not the rider's
          // share, and Earnings has the real figures.
          <Gutter style={{ gap: 8 }}>
            {active.length > 0 ? <Text className="mb-1 font-sans-bold text-ui text-ink">On now</Text> : null}
            {active.map((order) => (
              <OrderCardRow
                key={order.id}
                order={order}
                showDate={false}
                onPress={() => navigation.navigate("ActiveDelivery", { orderId: order.id })}
              />
            ))}
            {past.length > 0 ? <Text className="mb-1 mt-4 font-sans-bold text-ui text-ink">Done</Text> : null}
            {past.map((order) => (
              <OrderCardRow key={order.id} order={order} onPress={() => undefined} />
            ))}
          </Gutter>
        )}
      </ScreenBody>
    </Screen>
  );
}

