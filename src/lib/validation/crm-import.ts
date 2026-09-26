import { z } from "zod";

export const crmImportEntityValues = ["lead", "contact"] as const;
export const crmImportDuplicateStrategyValues = ["skip", "create"] as const;

export const crmImportSchema = z.object({
  entityType: z.enum(crmImportEntityValues),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(250),
  mapping: z.record(z.string(), z.string()),
  duplicateStrategy: z.enum(crmImportDuplicateStrategyValues).default("skip"),
  dryRun: z.boolean().default(true),
});

export type CrmImportInput = z.infer<typeof crmImportSchema>;
export type CrmImportEntity = (typeof crmImportEntityValues)[number];
