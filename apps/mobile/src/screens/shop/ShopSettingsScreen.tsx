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
import { useLayout } from "../../hooks/useLayout";
import { signOut } from "../../lib/auth";
import {
  hasSupportContact,
  openSupportContact,
  supportContactLabel,
} from "../../lib/support";

export function ShopSettingsScreen() {
  const { shop, shops, selectShop } = useSelectedShop();
  const setServing = useSetShopServing(shop?.id);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { isDesktop } = useLayout();

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className={isDesktop ? "pb-8 pt-8" : "pb-8 pt-4"}>
          {isDesktop ? (
            <>
              <Text className="font-sans-bold text-heading text-ink">Settings</Text>
              <Text className="mt-1 font-sans text-ui text-muted">
                Storefront status and account for {shop?.name ?? "your shop"}.
              </Text>
            </>
          ) : (
            <>
              <PageTitle>{shop?.name ?? "Your shop"}</PageTitle>
              <Text className="mt-2 font-sans text-body text-muted">
                {[shop?.category, shop?.locationText].filter(Boolean).join(" · ") || "—"}
              </Text>
            </>
          )}
        </Gutter>

        {shops && shops.length > 1 ? (
          <Gutter className="mb-6">
            <ShopSwitcher shops={shops} selectedId={shop?.id} onSelect={selectShop} />
          </Gutter>
        ) : null}

        <Gutter>
          <View
            className={isDesktop ? "flex-row flex-wrap" : undefined}
            style={isDesktop ? { gap: 24 } : undefined}
          >
            <View
              className={`flex-row items-center gap-3 rounded-card bg-surface p-5 ${
                isDesktop ? "" : "mb-8"
              }`}
              style={isDesktop ? { flex: 1, minWidth: 280 } : undefined}
            >
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
                accessibilityLabel={
                  shop?.isActive === false ? "Shop is paused" : "Shop is serving orders"
                }
              />
            </View>

            <View style={isDesktop ? { flex: 1, minWidth: 280 } : undefined}>
              <RowGroup>
                {isDesktop ? (
                  <Row
                    title={shop?.name ?? "Your shop"}
                    meta={[shop?.category, shop?.locationText].filter(Boolean).join(" · ") || "—"}
                    chevron={false}
                  />
                ) : null}
                {shop?.openingTime && shop?.closingTime ? (
                  <Row
                    title={`${shop.openingTime} – ${shop.closingTime}`}
                    meta="Opening hours"
                    chevron={false}
                  />
                ) : null}
                {hasSupportContact() ? (
                  <Row
                    title="Help & support"
                    meta={supportContactLabel()}
                    onPress={() => void openSupportContact()}
                  />
                ) : null}
              </RowGroup>

              <View className="mt-8">
                <Row title="Log out" onPress={() => setConfirmLogout(true)} chevron={false} />
              </View>
            </View>
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
