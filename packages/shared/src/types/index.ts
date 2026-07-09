export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// PIN hash is intentionally never part of any client-facing order shape.
export type ClientSafeOrderFields =
  | "id"
  | "studentId"
  | "riderId"
  | "shopId"
  | "checkpointId"
  | "universityId"
  | "itemDescription"
  | "productId"
  | "itemPrice"
  | "deliveryFee"
  | "discountApplied"
  | "surchargeApplied"
  | "totalAmount"
  | "deliveryDay"
  | "scheduledDate"
  | "isSpecialOrder"
  | "status"
  | "paidAt"
  | "deliveredAt"
  | "notes"
  | "createdAt"
  | "updatedAt";
