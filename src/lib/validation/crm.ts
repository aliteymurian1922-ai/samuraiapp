import { z } from "zod";

export const crmLeadStatusValues = ["new", "contacted", "qualified", "unqualified", "converted"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const createLeadSchema = z.object({
  name: z.string().trim().min(2, "نام سرنخ را وارد کنید.").max(160),
  companyName: optionalText(180),
  phone: optionalText(50),
  email: z.string().trim().email("ایمیل معتبر نیست.").max(255).optional().nullable().or(z.literal("")),
  source: optionalText(80),
  estimatedValue: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  notes: optionalText(4000),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  status: z.enum(crmLeadStatusValues).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  notes: optionalText(4000),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "نام مشتری را وارد کنید.").max(160),
  companyName: optionalText(180),
  jobTitle: optionalText(120),
  phone: optionalText(50),
  email: z.string().trim().email("ایمیل معتبر نیست.").max(255).optional().nullable().or(z.literal("")),
  source: optionalText(80),
  ownerId: z.string().uuid().optional().nullable(),
  notes: optionalText(4000),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const createDealSchema = z.object({
  title: z.string().trim().min(2, "عنوان فرصت را وارد کنید.").max(200),
  value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  stageId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  source: optionalText(80),
  expectedCloseAt: z.string().datetime().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).max(999).default(1),
});
export type CreateDealInput = z.infer<typeof createDealSchema>;

export const updateDealSchema = z.object({
  stageId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200).optional(),
  value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  expectedCloseAt: z.string().datetime().optional().nullable(),
  lostReason: optionalText(300),
});
export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const crmActivityTypeValues = ["call", "message", "email", "meeting", "note", "task"] as const;

export const createCrmActivitySchema = z.object({
  type: z.enum(crmActivityTypeValues),
  title: z.string().trim().min(2, "عنوان پیگیری را وارد کنید.").max(200),
  note: optionalText(4000),
  dueAt: z.string().datetime().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
});
export type CreateCrmActivityInput = z.infer<typeof createCrmActivitySchema>;

export const updateCrmActivitySchema = z.object({
  completed: z.boolean().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
});
export type UpdateCrmActivityInput = z.infer<typeof updateCrmActivitySchema>;

export const createCrmProductSchema = z.object({
  name: z.string().trim().min(2, "نام محصول یا خدمت را وارد کنید.").max(180),
  sku: optionalText(80),
  unitPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  description: optionalText(4000),
});
export type CreateCrmProductInput = z.infer<typeof createCrmProductSchema>;


export const convertDealToProjectSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  color: z.string().trim().max(20).default("#4f46e5"),
  dueDate: z.string().datetime().optional().nullable(),
  memberIds: z.array(z.string().uuid()).default([]),
});
export type ConvertDealToProjectInput = z.infer<typeof convertDealToProjectSchema>;
