import { z } from "zod";
import { COMPANY_RATE_TYPES, DELIVERY_MODES } from "../constants/delivery";

const phone = z.string().trim().min(9, "Enter a phone number").max(20);

export const createCompanySchema = z
  .object({
    name: z.string().trim().min(2, "Enter the company's name").max(120),
    contactName: z.string().trim().max(120).optional(),
    contactPhone: phone.optional(),
  })
  .strict();

export const updateCompanySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    contactName: z.string().trim().max(120).nullable().optional(),
    contactPhone: phone.nullable().optional(),
    isActive: z.boolean().optional(),
    // Both or neither: a rate type with no value would pay nothing.
    rateType: z.enum(COMPANY_RATE_TYPES).nullable().optional(),
    rateValue: z.number().min(0).max(10000).nullable().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.rateType === undefined ||
      v.rateType === null ||
      (typeof v.rateValue === "number" && (v.rateType !== "percent" || v.rateValue <= 100)),
    { message: "Give the rate an amount (a percentage can't be over 100)", path: ["rateValue"] },
  );

export const addCompanyMemberSchema = z
  .object({
    phone,
    as: z.enum(["rider", "dispatcher"]),
  })
  .strict();

export const setDeliveryModeSchema = z
  .object({
    mode: z.enum(DELIVERY_MODES),
    companyId: z.string().uuid().nullable().optional(),
    /** Where the company brings orders; shown on its list. */
    hubAddress: z.string().trim().min(3, "Give the packing point an address").max(200).optional(),
  })
  .strict()
  .refine((v) => v.mode !== "company" || !!v.companyId, {
    message: "Choose which company runs deliveries",
    path: ["companyId"],
  });

export const assignOrderSchema = z.object({ riderId: z.string().uuid() }).strict();

export const runSheetQuerySchema = z.object({
  date: z.string().date().optional(),
});

export const statementQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

/** Move a batch of packing-point orders on one stage. */
export const hubAdvanceSchema = z
  .object({
    orderIds: z.array(z.string().uuid()).min(1).max(500),
  })
  .strict();
