import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  CheckoutProgress,
  Gutter,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Sheet,
  TopBar,
  WaveContextBanner,
} from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { useLastCheckpoint } from "../../hooks/useLastCheckpoint";
import { formatFullDay, formatGhs } from "../../lib/pricing";
import { DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT } from "@wave/shared";

type Route = RouteProp<StudentStackParamList, "DescribeOrder">;

/**
 * Where and when — the last question before review.
 *
 * This screen used to be the whole order: a free-text "Your list" box, a budget
 * cap, a day picker and a checkpoint picker. Two of those are gone and it is
 * worth saying why, because both were load-bearing before:
 *
 *  - **The list** moved to `ShopMenuScreen`, where the shop's real catalogue
 *    supplies names and prices. Wave now knows what an order is worth before a
 *    runner leaves.
 *  - **The budget cap** is gone entirely. It existed because nobody knew the
 *    price up front, so the student capped their exposure. With a priced basket
 *    the total is on the next screen, and a spend limit on a known total is a
 *    field that can only contradict it.
 *
 * The day is now chosen on the calendar before any of this, so it is shown here
 * as a fact rather than a picker.
 */
export function DescribeOrderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);

  const checkpointIds = checkpoints?.map((c) => c.id);
  const { checkpointId, selectCheckpoint } = useLastCheckpoint(checkpointIds);
  const [pickerOpen, setPickerOpen] = useState(false);

  const checkpoint = checkpoints?.find((c) => c.id === checkpointId) ?? checkpoints?.[0];
  const scheduledDate = new Date(params.scheduledDate);

  const itemCount = params.itemsPreview.reduce((n, l) => n + l.quantity, 0);
  const basketTotal = params.itemsPreview.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <CheckoutProgress step={2} />
          <WaveContextBanner
            scheduledDate={params.scheduledDate}
            checkpointName={checkpoint?.name}
            isSpecialOrder={params.isSpecialOrder}
          />
          <Text className="mb-2 font-sans-bold text-heading text-ink">Where do you want it?</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            {itemCount} item{itemCount === 1 ? "" : "s"} from {params.shopName} ·{" "}
            {formatGhs(basketTotal)}
          </Text>

          <Text className="mb-2 font-sans-medium text-body text-ink">Delivery</Text>
          <RowGroup>
            <Row
              title={checkpoint?.name ?? "Choose a checkpoint"}
              meta={checkpoint?.description ?? "Where you'll collect it"}
              onPress={() => setPickerOpen(true)}
            />
            <Row
              title={formatFullDay(scheduledDate)}
              meta={
                params.isSpecialOrder
                  ? `Rush order · ${DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}% more on the delivery fee`
                  : "Standard Wave"
              }
              chevron={false}
            />
          </RowGroup>

          <Text className="mt-6 font-sans text-body text-muted">
            Need a different day? Go back to the calendar.
          </Text>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Review order"
          disabled={!checkpoint}
          onPress={() =>
            navigation.navigate("OrderSummary", {
              shopId: params.shopId,
              shopName: params.shopName,
              items: params.items,
              itemsPreview: params.itemsPreview,
              scheduledDate: params.scheduledDate,
              isSpecialOrder: params.isSpecialOrder,
              checkpointId: checkpoint!.id,
              checkpointName: checkpoint!.name,
              notes: params.notes,
            })
          }
        />
      </ActionBar>

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Where?">
        <View className="gap-1">
          {(checkpoints ?? []).map((c) => (
            <Row
              key={c.id}
              title={c.name}
              meta={c.description ?? undefined}
              chevron={false}
              trailing={
                checkpoint?.id === c.id ? (
                  <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} />
                ) : null
              }
              onPress={() => {
                selectCheckpoint(c.id);
                setPickerOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
