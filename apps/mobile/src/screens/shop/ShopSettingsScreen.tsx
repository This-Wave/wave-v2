import { useState } from "react";
import { Text, View } from "react-native";
import {
  Confirm,
  Gutter,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
} from "../../components/v6";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { ShopSwitcher } from "../../components/shop/ShopSwitcher";
import { useSelectedShop, useSetShopServing } from "../../lib/shopOwner";
import { signOut } from "../../lib/auth";

export function ShopSettingsScreen() {
  const { shop, shops, selectShop } = useSelectedShop();
  const setServing = useSetShopServing(shop?.id);
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-8 pt-4">
          <PageTitle>{shop?.name ?? "Your shop"}</PageTitle>
          <Text className="mt-2 font-sans text-body text-muted">
            {[shop?.category, shop?.locationText].filter(Boolean).join(" · ") || "—"}
          </Text>
        </Gutter>

        {shops && shops.length > 1 ? (
          <Gutter className="mb-6">
            <ShopSwitcher shops={shops} selectedId={shop?.id} onSelect={selectShop} />
          </Gutter>
        ) : null}

        <Gutter className="mb-8">
          <View className="flex-row items-center gap-3 rounded-card bg-surface p-5">
            <View className="flex-1">
              <Text className="font-sans-medium text-body text-ink">Serving</Text>
              <Text className="font-sans text-body text-muted">
                {setServing.isError
                  ? "Couldn't update — check your connection."
                  : shop?.isActive === false
                    ? "Paused. Students can't see your shop."
                    : "Students can order from you right now."}
              </Text>
            </View>
            <ToggleSwitch
              value={shop?.isActive ?? false}
              disabled={!shop || setServing.isPending}
              onValueChange={(next) => setServing.mutate(next)}
            />
          </View>
        </Gutter>

        <Gutter>
          <RowGroup>
            {shop?.openingTime && shop?.closingTime ? (
              <Row
                title={`${shop.openingTime} – ${shop.closingTime}`}
                meta="Opening hours"
                chevron={false}
              />
            ) : null}
          </RowGroup>

          <View className="mt-8">
            <Row title="Log out" onPress={() => setConfirmLogout(true)} chevron={false} />
          </View>
        </Gutter>
      </ScreenBody>

      <Confirm
        visible={confirmLogout}
        title="Log out?"
        body="You'll need your phone number and a code to get back in."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirmLogout(false);
          void signOut();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}
