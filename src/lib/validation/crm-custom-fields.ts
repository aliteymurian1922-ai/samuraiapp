import { z } from "zod";

export const crmCustomFieldEntityValues = ["lead", "contact", "deal"] as const;
export const crmCustomFieldTypeValues = ["text", "number", "date", "select", "boolean"] as const;

export const createCrmCustomFieldSchema = z.object({
  entityType: z.enum(crmCustomFieldEntityValues),
  name: z.string().trim().min(2, "نام فیلد را وارد کنید.").max(120),
  fieldType: z.enum(crmCustomFieldTypeValues),
  options: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  isRequired: z.boolean().default(false),
});

export const updateCrmCustomFieldSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  position: z.number().int().min(0).max(10000).optional(),
});

export const setCrmCustomFieldValuesSchema = z.object({
  entityType: z.enum(crmCustomFieldEntityValues),
  entityId: z.string().uuid(),
  values: z.record(
    z.string().uuid(),
    z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]),
  ),
});

export type CrmCustomFieldEntity = (typeof crmCustomFieldEntityValues)[number];
export type CrmCustomFieldType = (typeof crmCustomFieldTypeValues)[number];
export type CreateCrmCustomFieldInput = z.infer<typeof createCrmCustomFieldSchema>;
export type UpdateCrmCustomFieldInput = z.infer<typeof updateCrmCustomFieldSchema>;
export type SetCrmCustomFieldValuesInput = z.infer<typeof setCrmCustomFieldValuesSchema>;
