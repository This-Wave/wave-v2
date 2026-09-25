import { useState } from "react";
import { Text, View } from "react-native";
import {
  BrandBar,
  Confirm,
  Gutter,
  PageTitle,
  Screen,
  ScreenBody,
  SettingsGroup,
  SettingsRow,
  Switch,
} from "../../components/v6";
import {
  BoltIcon,
  CalendarIcon,
  CartIcon,
  LogoutIcon,
  MessageIcon,
} from "../../components/icons";
import { colors } from "../../theme/tokens";
import { ShopSwitcher } from "../../components/shop/ShopSwitcher";
import { useSelectedShop, useSetShopServing } from "../../lib/shopOwner";
import { useLayout } from "../../hooks/useLayout";
import { signOut } from "../../lib/auth";
import {
  hasSupportContact,
  openSupportContact,
  supportContactLabel,
} from "../../lib/support";
import { AppearanceSettings } from "../../components/AppearanceSettings";

export function ShopSettingsScreen() {
  const { shop, shops, selectShop } = useSelectedShop();
  const setServing = useSetShopServing(shop?.id);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { isDesktop } = useLayout();

  return (
    <Screen>
      <BrandBar />
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
            {/* The switch in a titled row, as the reference does it. The row
                itself is not pressable — the switch is the control, and two
                overlapping targets for one setting is worse than one. */}
            <View style={isDesktop ? { flex: 1, minWidth: 280 } : undefined}>
              <SettingsGroup title="Storefront">
                <SettingsRow
                  icon={<BoltIcon size={18} color={colors.ink} strokeWidth={1.8} />}
                  label="Serving"
                  value={
                    setServing.isError
                      ? "Couldn't update — check your connection."
                      : shop?.isActive === false
                        ? "Paused. Students can't see your shop."
                        : "Students can order from you right now."
                  }
                  trailing={
                    <Switch
                      value={shop?.isActive ?? false}
                      disabled={!shop || setServing.isPending}
                      onValueChange={(next) => setServing.mutate(next)}
                      accessibilityLabel="Shop is serving orders"
                      accessibilityHint="Turn off to pause the shop and hide it from students"
                    />
                  }
                  last={!(shop?.openingTime && shop?.closingTime)}
                />
                {shop?.openingTime && shop?.closingTime ? (
                  <SettingsRow
                    icon={<CalendarIcon size={18} color={colors.ink} strokeWidth={1.8} />}
                    label={`${shop.openingTime} – ${shop.closingTime}`}
                    value="Opening hours"
                    last
                  />
                ) : null}
              </SettingsGroup>
            </View>

            <View style={isDesktop ? { flex: 1, minWidth: 280 } : undefined}>
              {isDesktop || hasSupportContact() ? (
                <SettingsGroup title="Shop">
                  {isDesktop ? (
                    <SettingsRow
                      icon={<CartIcon size={18} color={colors.ink} strokeWidth={1.8} />}
                      label={shop?.name ?? "Your shop"}
                      value={
                        [shop?.category, shop?.locationText].filter(Boolean).join(" · ") || "—"
                      }
                      last={!hasSupportContact()}
                    />
                  ) : null}
                  {hasSupportContact() ? (
                    <SettingsRow
                      icon={<MessageIcon size={18} color={colors.ink} strokeWidth={1.8} />}
                      label="Help & support"
                      value={supportContactLabel()}
                      onPress={() => void openSupportContact()}
                      last
                    />
                  ) : null}
                </SettingsGroup>
              ) : null}

              <AppearanceSettings />

              <SettingsGroup title="Account">
                <SettingsRow
                  icon={<LogoutIcon size={18} color={colors.danger} strokeWidth={1.8} />}
                  label="Log out"
                  danger
                  chevron={false}
                  onPress={() => setConfirmLogout(true)}
                  last
                />
              </SettingsGroup>
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
