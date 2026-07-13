import type { ProfileRole } from "@wave/shared";

export interface Profile {
  id: string;
  universityId: string | null;
  fullName: string;
  phone: string;
  studentId: string | null;
  role: ProfileRole;
  avatarUrl: string | null;
  pushToken: string | null;
  isActive: boolean;
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

// Decimal fields come back JSON-serialized as strings from Prisma — parse with
// Number(...) at the point of display, never assume they're already numbers.
export interface Order {
  id: string;
  studentId: string;
  riderId: string | null;
  shopId: string;
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
  deliveredAt: string | null;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  shop?: Shop | null;
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
  createdAt: string;
  order?: { id: string; createdAt: string; shop?: { name: string } | null } | null;
}

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface RiderVerification {
  id: string;
  riderId: string;
  idType: "ghana_card" | "student_id" | "passport";
  idNumber: string;
  idImageUrl: string;
  selfieUrl: string;
  status: VerificationStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
