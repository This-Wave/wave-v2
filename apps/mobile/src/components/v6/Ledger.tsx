import { Text, View } from "react-native";
import type { OrderLedger } from "../../lib/ledger";
import { formatGhsCompact } from "../../lib/pricing";

/**
 * The cost breakdown block. Takes a built ledger — never raw order columns, see
 * `lib/ledger.ts` for why.
 *
 * When the lines cannot be reconciled with the persisted total, the breakdown is
 * suppressed and only the total shows. A student seeing numbers that do not add
 * up loses trust in the charge itself, which is worse than seeing less detail.
 */
export function Ledger({ ledger }: { ledger: OrderLedger }) {
  return (
    <View>
      {ledger.reconciles
        ? ledger.lines.map((line) => (
            <View key={line.label} className="flex-row items-center justify-between py-2.5">
              <Text className="font-sans text-body text-muted">{line.label}</Text>
              <Text
                className={`font-sans text-body ${
                  line.kind === "discount" ? "text-ink" : "text-ink"
                }`}
              >
                {line.value}
              </Text>
            </View>
          ))
        : null}

      <View className="mt-1 h-px bg-hairline" />

      <View className="flex-row items-center justify-between pt-4">
        <Text className="font-sans-medium text-ui text-ink">{ledger.totalLabel}</Text>
        <Text className="font-sans-bold text-heading-sm text-ink">
          {formatGhsCompact(ledger.total)}
        </Text>
      </View>
    </View>
  );
}
