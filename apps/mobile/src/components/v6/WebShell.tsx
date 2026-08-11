import { Platform, View } from "react-native";
import type { ReactNode } from "react";
import { colors } from "../../theme/tokens";
import { layout } from "../../theme/layout";
import { useLayout } from "../../hooks/useLayout";
import { useDesktopPanelStore } from "../../store/desktopPanelStore";
import { SideNav, type AppRole } from "./SideNav";
import { DesktopPanelHost } from "./DesktopPanelHost";
import { LiveOrderBar } from "./LiveOrderBar";
import { ActiveDeliveryBar } from "./ActiveDeliveryBar";
import { PanelScrim } from "./RightPanel";

/**
 * Auth / generic web frame — centered narrow column.
 */
export function WebShell({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        minHeight: "100%",
        backgroundColor: colors.canvas,
        alignItems: "center",
      }}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: layout.narrowMaxWidth + 64,
          backgroundColor: colors.canvas,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Role desktop chrome: left nav + full-width main + optional right panel.
 * Narrow web / phone: passthrough (bottom tabs).
 */
export function AppWebShell({ role, children }: { role: AppRole; children: ReactNode }) {
  const { isDesktop } = useLayout();
  const panelOpen = useDesktopPanelStore((s) => s.panel !== null);
  const closePanel = useDesktopPanelStore((s) => s.closePanel);

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  if (!isDesktop) {
    return (
      <View style={{ flex: 1, width: "100%", backgroundColor: colors.canvas }}>{children}</View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        width: "100%",
        minHeight: "100vh" as unknown as number,
        backgroundColor: colors.canvas,
      }}
    >
      <SideNav role={role} />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: colors.canvas,
          paddingHorizontal: 28,
          position: "relative",
        }}
      >
        {role === "student" ? <LiveOrderBar /> : null}
        {role === "rider" ? <ActiveDeliveryBar /> : null}
        {panelOpen ? <PanelScrim onPress={closePanel} /> : null}
        <View style={{ flex: 1, width: "100%", backgroundColor: colors.canvas }}>{children}</View>
      </View>
      {panelOpen ? <DesktopPanelHost /> : null}
    </View>
  );
}

/** @deprecated Prefer `AppWebShell role="student"` — kept for existing imports. */
export function StudentWebShell({ children }: { children: ReactNode }) {
  return <AppWebShell role="student">{children}</AppWebShell>;
}

export function NarrowColumn({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <View
      style={{
        width: "100%",
        maxWidth: layout.narrowMaxWidth,
        alignSelf: "center",
        flex: 1,
      }}
    >
      {children}
    </View>
  );
}
