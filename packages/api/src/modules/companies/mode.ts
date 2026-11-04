import type { FastifyInstance } from "fastify";
import {
  DEFAULT_DELIVERY_MODE,
  DELIVERY_COMPANY_KEY,
  DELIVERY_MODE_KEY,
  isDeliveryMode,
  type DeliveryMode,
} from "@wave/shared";

export interface ActiveDelivery {
  mode: DeliveryMode;
  /** Set only in company mode, and only when that company exists and is active. */
  company: { id: string; name: string } | null;
}

/**
 * Who runs deliveries right now.
 *
 * Company mode with no usable company (unset, deleted or deactivated) reads as
 * company mode with `company: null`. It does NOT fall back to independent:
 * quietly reopening the open feed to every rider because a setting went stale
 * would put jobs in front of people the business has stopped working with.
 * Orders then wait as unassigned until an admin fixes the setting.
 */
export async function activeDelivery(fastify: FastifyInstance): Promise<ActiveDelivery> {
  const rows = await fastify.prisma.platformConfig.findMany({
    where: { key: { in: [DELIVERY_MODE_KEY, DELIVERY_COMPANY_KEY] } },
    select: { key: true, value: true },
  });
  const raw = rows.find((r) => r.key === DELIVERY_MODE_KEY)?.value;
  const mode: DeliveryMode = isDeliveryMode(raw) ? raw : DEFAULT_DELIVERY_MODE;
  if (mode === "independent") return { mode, company: null };

  const companyId = rows.find((r) => r.key === DELIVERY_COMPANY_KEY)?.value;
  if (!companyId) return { mode, company: null };
  const company = await fastify.prisma.deliveryCompany.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, isActive: true },
  });
  return { mode, company: company?.isActive ? { id: company.id, name: company.name } : null };
}
