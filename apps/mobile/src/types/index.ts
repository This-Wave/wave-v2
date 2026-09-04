import type { ProfileRole } from "@wave/shared";

export interface Profile {
  id: string;
  universityId: string | null;
  fullName: string;
  phone: string;
  studentId: string | null;
  email: string | null;
  role: ProfileRole;
  avatarUrl: string | null;
  pushToken: string | null;
  /** Account ban flag, admin-controlled. False means the API 403s everything. */
  isActive: boolean;
  /** Rider's own online/offline toggle. Meaningless on other roles. */
  isAvailable: boolean;
  /** Riders only; null for every other role. Decides documents, pay and access. */
  riderType?: "student" | "external" | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface University {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  isActive: boolean;
}

export interface Checkpoint {
  id: string;
  universityId: string;
  name: string;
  description: string | null;
  /**
   * Prisma `Decimal` serialises as a string over JSON. Null for checkpoints
   * whose coordinates nobody has recorded yet, which is most of them until
   * someone walks the campus — so every consumer must handle the absence.
   */
  latitude: string | null;
  longitude: string | null;
  isActive: boolean;
}

export interface Shop {
  id: string;
  ownerId: string;
  universityId: string;
  name: string;
  description: string | null;
  category: string;
  logoUrl: string | null;
  phone: string | null;
  locationText: string | null;
  openingTime: string | null;
  closingTime: string | null;
  isActive: boolean;
  isVerified: boolean;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  category: string | null;
  status: "active" | "out_of_stock" | "not_serving";
}

export type OrderStatus =
  | "pending"
  | "payment_pending"
  | "confirmed"
  | "rider_assigned"
  | "en_route"
  | "at_checkpoint"
  | "delivered"
  | "cancelled"
  | "refunded";

export type DeliveryDay = "sunday" | "wednesday" | "special";

export type OrderType = "buy_for_me" | "pickup" | "shop_pickup";

export type SuggestionStatus = "pending" | "onboarded" | "rejected";

/**
 * A shop a student asked for that Wave doesn't carry yet.
 *
 * `status` is what decides whether it can still be ordered from: once it is
 * `onboarded` the real shop exists and ordering moves to its catalogue.
 */
export interface ShopSuggestion {
  id: string;
  studentId: string;
  universityId: string;
  name: string;
  normalizedName: string;
  locationText: string | null;
  category: string | null;
  status: SuggestionStatus;
  resolvedShopId: string | null;
  createdAt: string;
  resolvedShop?: Pick<Shop, "id" | "name" | "logoUrl"> | null;
}

/**
 * One line of the basket.
 *
 * `unitPrice` is null on a manual list (nobody knows the price yet) and
 * `actualUnitPrice` is null until the rider records what they paid at the till.
 * Both are strings for the same reason as every other Decimal here.
 */
export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  unitPrice: string | null;
  quantity: number;
  actualUnitPrice: string | null;
}

// Decimal fields come back JSON-serialized as strings from Prisma — parse with
// Number(...) at the point of display, never assume they're already numbers.
export interface Order {
  id: string;
  studentId: string;
  riderId: string | null;
  orderType: OrderType;
  originCheckpointId: string | null;
  originCheckpoint?: Checkpoint | null;
  /** Null on a pickup order — there is no shop involved. */
  shopId: string | null;
  /** Set only on a shop_pickup — the suggested shop this order buys from. */
  suggestionId: string | null;
  checkpointId: string;
  universityId: string;
  productId: string | null;
  itemDescription: string;
  itemPrice: string | null;
  deliveryFee: string;
  discountApplied: string;
  surchargeApplied: string;
  totalAmount: string;
  status: OrderStatus;
  deliveryDay: DeliveryDay;
  scheduledDate: string;
  isSpecialOrder: boolean;
  paystackRef: string | null;
  paidAt: string | null;
  /** Set when the second charge on a shop_pickup clears. Null on other types. */
  goodsPaidAt: string | null;
  shopAcceptedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  shop?: Shop | null;
  suggestion?: Pick<ShopSuggestion, "id" | "name" | "locationText" | "category" | "status"> | null;
  items?: OrderItem[];
  checkpoint?: Checkpoint | null;
  student?: Profile | null;
  rider?: Profile | null;
}

export type EarningStatus = "pending" | "paid";

export interface RiderEarning {
  id: string;
  riderId: string;
  orderId: string;
  amount: string;
  status: EarningStatus;
  paidAt: string | null;
  shopAcceptedAt: string | null;
  createdAt: string;
  order?: { id: string; createdAt: string; shop?: { name: string } | null } | null;
}

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface RiderVerification {
  id: string;
  riderId: string;
  idType: "ghana_card" | "student_id" | "passport";
  idNumber: string;
  // Signed fresh on every read and null if signing failed — the DB stores the
  // Storage path, not these URLs.
  idImageUrl: string | null;
  selfieUrl: string | null;
  status: VerificationStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
