import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { AppWebShell, Screen, ScreenBody, ListSkeleton, Gutter } from "../components/v6";
import { stackScreenOptions, tabsStackScreenOptions } from "../lib/navigationMotion";
import { ShopTabNavigator, type ShopTabParamList } from "./ShopTabNavigator";
import { IncomingOrderDetailScreen } from "../screens/shop/IncomingOrderDetailScreen";
import { ShopSetupScreen } from "../screens/shop/ShopSetupScreen";
import { FirstRunTour } from "../components/FirstRunTour";
import { useMyShops } from "../lib/shopOwner";

export type ShopStackParamList = {
  Tabs: NavigatorScreenParams<ShopTabParamList> | undefined;
  IncomingOrderDetail: { orderId: string };
};

const Stack = createNativeStackNavigator<ShopStackParamList>();

/**
 * Shop gate.
 *
 * A shop owner is the one role that arrives owning nothing. Every shop screen
 * acts on "the selected shop", and `useSelectedShop` returns null when the list
 * is empty — so before onboarding existed, a self-registered owner saw a
 * dashboard with no shop name, no orders and no way to create one, because
 * shops were admin-created only.
 *
 * The gate is on *having* a shop, not on it being approved. An owner waiting
 * for approval still has real work to do — adding their menu — and the
 * dashboard says plainly that students cannot see them yet.
 */
export function ShopNavigator() {
  const { data: shops, isLoading } = useMyShops();

  if (isLoading) {
    return (
      <AppWebShell role="shop">
        <Screen>
          <ScreenBody>
            <Gutter className="pt-8">
              <ListSkeleton />
            </Gutter>
          </ScreenBody>
        </Screen>
      </AppWebShell>
    );
  }

  if (!shops || shops.length === 0) {
    return (
      <AppWebShell role="shop">
        <ShopSetupScreen />
      </AppWebShell>
    );
  }

  return (
    <AppWebShell role="shop">
      <Stack.Navigator screenOptions={() => stackScreenOptions("app")}>
        <Stack.Screen name="Tabs" component={ShopTabNavigator} options={tabsStackScreenOptions} />
        <Stack.Screen name="IncomingOrderDetail" component={IncomingOrderDetailScreen} />
      </Stack.Navigator>
      <FirstRunTour role="shop_owner" />
    </AppWebShell>
  );
}
