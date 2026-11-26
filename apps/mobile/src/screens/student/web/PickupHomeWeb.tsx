import { Linking, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../../navigation/StudentNavigator";
import { Button, ServicePausedNotice, StatusPill } from "../../../components/v6";
import { BellIcon, GiftIcon, PlusIcon, StoreIcon } from "../../../components/icons";
import { colors } from "../../../theme/tokens";
import { Illustration } from "../../../components/v7/Illustration";
import { RouteLine } from "../../../components/v7/Signature";
import { OrderCardRow } from "../../../components/v7/OrderCards";
import { LIVE_ORDER_STATUSES, useMyOrders } from "../../../lib/orders";
import { useServiceStatus } from "../../../lib/serviceStatus";
import { openOrderDetail, openOrderTracking } from "../../../lib/desktopNavigate";
import { parsePickupNotes } from "../../../lib/pickupNotes";
import { useAuthStore, useIsGuest } from "../../../store/authStore";
import { statusPill, trackerSteps } from "../orderPresenters";
import type { Order } from "../../../types";
import { describeWave } from "../../../lib/wave";
import { isStandardRunDay } from "../../../lib/pricing";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

function nextWave(): { scheduledDate: string; isSpecialOrder: boolean } {
  const d = describeWave()?.date ?? new Date();
  return { scheduledDate: d.toISOString(), isSpecialOrder: !isStandardRunDay(d) };
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/**
 * v7 canvas "Web home": the parcel on its way as a wide card (route on the
 * left, progress and actions on the right), the three things you can do, the
 * people who sent to you before, and a Recent panel on the right.
 */
export function PickupHomeWeb() {
  const navigation = useNavigation<Nav>();
  const isGuest = useIsGuest();
  const { data: orders } = useMyOrders();
  const { data: service } = useServiceStatus();
  const first = useAuthStore((s) => (s.profile?.fullName ?? s.guestFirstName ?? "").trim().split(/\s+/)[0]);
  const loaded = isGuest || orders !== undefined;
  const list = orders ?? [];
  const live = list.filter((o) => LIVE_ORDER_STATUSES.includes(o.status));
  const recent = list.filter((o) => o.status === "delivered").slice(0, 4);
  const paused = service?.pickup.paused;

  // Past senders, newest first, one chip each.
  const senders: { name: string; phone?: string | null; zone?: string }[] = [];
  for (const o of list) {
    if (!o.senderName || senders.some((x) => x.name === o.senderName)) continue;
    senders.push({ name: o.senderName, phone: o.senderPhone, zone: o.originCheckpoint?.name?.split(" & ")[0] });
    if (senders.length === 3) break;
  }

  const title = !loaded ? "" : live.length > 0 ? `${live.length} parcel${live.length === 1 ? "" : "s"} on the way` : "Nothing on the way yet";

  return (
    // The shell pads its stage by 28px; this page runs to the edges like the
    // canvas, with its own padding and a right panel flush to the window.
    <View className="flex-1 flex-row bg-canvas" style={{ marginHorizontal: -28 }}>
      <View className="flex-1" style={{ paddingHorizontal: 48, paddingTop: 40, gap: 24 }}>
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="font-sans text-ui text-muted">{first ? `${greeting()}, ${first}` : greeting()}</Text>
            <Text accessibilityRole="header" className="font-display text-ink" style={{ fontSize: 48, lineHeight: 54 }}>
              {title}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate("Tabs", { screen: "Orders" })}
            accessibilityRole="button"
            accessibilityLabel="Your orders"
            className="h-11 w-11 items-center justify-center rounded-input border-2 border-hairline bg-surface"
          >
            <BellIcon size={20} color={colors.ink} strokeWidth={1.8} />
          </Pressable>
        </View>

        {paused ? (
          <ServicePausedNotice service="Pickup" message={service?.pickup.message ?? ""} resumeAt={service?.pickup.resumeAt} />
        ) : null}

        {live.map((o) => (
          <ParcelWide
            key={o.id}
            order={o}
            onTrack={() => openOrderTracking(navigation, o.id)}
          />
        ))}

        {loaded && live.length === 0 ? (
          <View className="flex-row items-center rounded-card border border-hairline bg-surface p-6" style={{ gap: 24 }}>
            <Illustration name="pillow" width={200} height={140} />
            <View className="flex-1" style={{ gap: 6 }}>
              <Text className="font-display text-heading-sm text-ink">Someone in Accra can hand it over today.</Text>
              <Text className="font-sans text-ui text-muted">Tell us who is sending it. A rider collects and brings it to campus.</Text>
            </View>
          </View>
        ) : null}

        <View className="flex-row" style={{ gap: 16 }}>
          <ActionCard
            primary
            icon={<PlusIcon size={22} color={colors.onLime} strokeWidth={2.2} />}
            title="Send a package"
            body="Someone in Accra hands it over"
            disabled={!!paused}
            onPress={() => navigation.navigate("PickupRequest")}
          />
          <ActionCard
            icon={<StoreIcon size={21} color={colors.ink} strokeWidth={1.9} />}
            title="Suggest a shop"
            body="Name it, we pick it up"
            onPress={() => navigation.navigate("SuggestShop", nextWave())}
          />
          <ActionCard
            icon={<GiftIcon size={21} color={colors.ink} strokeWidth={1.9} />}
            title="Your code"
            body="Show it to collect"
            onPress={() =>
              live[0] ? navigation.navigate("PickupPin", { orderId: live[0].id }) : navigation.navigate("Tabs", { screen: "Orders" })
            }
          />
        </View>

        {senders.length > 0 ? (
          <View className="flex-row items-center rounded-card border border-hairline bg-surface p-4" style={{ gap: 20 }}>
            <Illustration name="pillow" width={110} height={80} />
            <View className="flex-1">
              <Text className="font-sans-bold text-subheading text-ink">Send again</Text>
              <Text className="font-sans text-ui text-muted">People who sent to you before.</Text>
            </View>
            <View className="flex-row" style={{ gap: 8 }}>
              {senders.map((p) => (
                <Pressable
                  key={p.name}
                  onPress={() =>
                    navigation.navigate("PickupRequest", { senderName: p.name, senderPhone: p.phone ?? undefined })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Send again from ${p.name}`}
                  className="min-h-[40px] justify-center rounded-input border-2 border-line bg-surface px-4"
                >
                  <Text className="font-sans-bold text-body text-ink">{p.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Right panel: what came before, and the business door. */}
      <View
        className="border-l border-hairline"
        style={{ width: 340, paddingHorizontal: 28, paddingTop: 44, paddingBottom: 28, justifyContent: "space-between" }}
      >
        <View style={{ gap: 12 }}>
          <Text className="font-sans-bold text-ui text-ink">Recent</Text>
          {recent.length === 0 ? (
            <Text className="font-sans text-body text-muted">Collected parcels show up here.</Text>
          ) : (
            recent.map((o) => <OrderCardRow key={o.id} order={o} onPress={() => openOrderDetail(navigation, o.id)} />)
          )}
        </View>
        <View className="rounded-card border border-hairline bg-surface p-5" style={{ gap: 6 }}>
          <Illustration name="stroll" width={130} height={100} />
          <Text className="mt-2 font-sans-bold text-ui text-ink">Own a business on campus?</Text>
          <Text className="font-sans text-body text-muted">We bring your stock from Accra.</Text>
          <Text
            accessibilityRole="link"
            onPress={() => navigation.navigate("BusinessInterest")}
            className="mt-1 font-sans-bold text-ui text-link"
          >
            Tell us about it
          </Text>
        </View>
      </View>
    </View>
  );
}

/** v7 canvas wide parcel card: route on the left, progress and keys on the right. */
function ParcelWide({ order, onTrack }: { order: Order; onTrack: () => void }) {
  const pill = statusPill(order.status, !!order.companyId);
  const steps = trackerSteps(order);
  const notes = parsePickupNotes(order.pickupNotes);
  const rider = order.rider;
  return (
    <View className="flex-row rounded-card border-2 border-ink bg-surface p-6" style={{ gap: 32 }}>
      <View className="flex-1" style={{ gap: 14 }}>
        <StatusPill label={pill.label} tone={pill.tone} />
        <RouteLine
          fromLabel="From"
          from={
            order.orderType === "pickup"
              ? [order.senderName, order.originCheckpoint?.name?.split(" & ")[0]].filter(Boolean).join(", ") || "Accra"
              : (order.shop?.name ?? "The shop")
          }
          fromSub={notes.building}
          toLabel="To you at"
          to={order.checkpoint?.name ?? "your pickup point"}
          toSub={order.itemDescription}
        />
      </View>
      <View className="flex-1 justify-center" style={{ gap: 20 }}>
        <View className="flex-row" style={{ gap: 8 }}>
          {steps.map((s) => (
            <View key={s.label} className="flex-1" style={{ gap: 8 }}>
              <View className={`h-1.5 rounded-pill ${s.done ? "bg-lime" : "bg-hairline"}`} />
              <Text className={`font-sans text-meta ${s.done ? "font-sans-bold text-ink" : "text-muted"}`} numberOfLines={2}>
                {s.label.replace(/^Picked up in .*/, "Picked up")}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row" style={{ gap: 10 }}>
          <Button label="Track" small full={false} onPress={onTrack} />
          {rider?.phone ? (
            <Button
              label="Call the rider"
              variant="ghost"
              small
              full={false}
              onPress={() => void Linking.openURL(`tel:${rider.phone}`)}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  body,
  onPress,
  primary,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      className={`flex-1 rounded-card border-2 border-b-4 border-line bg-surface p-5 ${disabled ? "opacity-50" : ""}`}
      style={{ gap: 6 }}
    >
      <View className={`mb-4 h-12 w-12 items-center justify-center rounded-pill ${primary ? "bg-lime" : "bg-wash"}`}>{icon}</View>
      <Text className="font-sans-bold text-subheading text-ink">{title}</Text>
      <Text className="font-sans text-body text-muted">{body}</Text>
    </Pressable>
  );
}
