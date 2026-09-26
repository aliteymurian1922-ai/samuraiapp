import "server-only";

import { db } from "@/db";
import {
  crmCompanies,
  crmContacts,
  crmCustomFields,
  crmCustomFieldValues,
  crmLeads,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api-response";
import { createCustomerSchema, createLeadSchema } from "@/lib/validation/crm";
import type { CrmImportInput } from "@/lib/validation/crm-import";
import {
  listCrmCustomFields,
  normalizeCrmCustomFieldValue,
} from "@/server/crm-custom-fields";

type Primitive = string | number | boolean | null;

type PreparedImportRow = {
  index: number;
  status: "ready" | "duplicate" | "invalid";
  reason: string | null;
  isDuplicate: boolean;
  base: Record<string, unknown> | null;
  customValues: Record<string, Primitive>;
  displayName: string;
  email: string | null;
  phone: string | null;
};

const LEAD_TARGETS = new Set([
  "name",
  "companyName",
  "phone",
  "email",
  "source",
  "estimatedValue",
  "notes",
]);

const CONTACT_TARGETS = new Set([
  "name",
  "companyName",
  "jobTitle",
  "phone",
  "email",
  "source",
  "notes",
]);

function latinDigits(value: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const faIndex = fa.indexOf(char);
    if (faIndex >= 0) return String(faIndex);
    const arIndex = ar.indexOf(char);
    return arIndex >= 0 ? String(arIndex) : char;
  });
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = latinDigits(value).replace(/\D/g, "");
  return digits || null;
}

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function numberFromText(value: string | undefined) {
  if (!value?.trim()) return null;
  const normalized = latinDigits(value).replace(/[٬,\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function valueFromRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
  target: string,
) {
  const source = Object.entries(mapping).find(([, mapped]) => mapped === target)?.[0];
  return source ? row[source] ?? "" : "";
}

function mappedCustomFields(mapping: Record<string, string>) {
  return Object.values(mapping)
    .filter((target) => target.startsWith("custom:"))
    .map((target) => target.slice("custom:".length));
}

async function existingIdentitySets(
  workspaceId: string,
  entityType: "lead" | "contact",
  emails: string[],
  phones: string[],
) {
  if (emails.length === 0 && phones.length === 0) {
    return { emails: new Set<string>(), phones: new Set<string>() };
  }

  const tableName = entityType === "lead" ? sql.raw("crm_leads") : sql.raw("crm_contacts");
  const conditions = [];

  if (emails.length > 0) {
    conditions.push(sql`
      lower(trim(coalesce(email, ''))) in (
        ${sql.join(emails.map((email) => sql`${email}`), sql`, `)}
      )
    `);
  }

  if (phones.length > 0) {
    conditions.push(sql`
      regexp_replace(
        translate(coalesce(phone, ''), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'),
        '[^0-9]',
        '',
        'g'
      ) in (
        ${sql.join(phones.map((phone) => sql`${phone}`), sql`, `)}
      )
    `);
  }

  const result = await db.execute(sql`
    select
      lower(trim(coalesce(email, ''))) as email,
      regexp_replace(
        translate(coalesce(phone, ''), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'),
        '[^0-9]',
        '',
        'g'
      ) as phone
    from ${tableName}
    where workspace_id = ${workspaceId}
      and (${sql.join(conditions, sql` or `)})
  `);

  const existingEmails = new Set<string>();
  const existingPhones = new Set<string>();

  for (const row of result.rows) {
    const email = typeof row.email === "string" ? row.email : "";
    const phone = typeof row.phone === "string" ? row.phone : "";
    if (email) existingEmails.add(email);
    if (phone) existingPhones.add(phone);
  }

  return { emails: existingEmails, phones: existingPhones };
}

export async function importCrmRows(
  workspaceId: string,
  userId: string,
  input: CrmImportInput,
) {
  const allowedTargets = input.entityType === "lead" ? LEAD_TARGETS : CONTACT_TARGETS;
  const targets = Object.values(input.mapping).filter(Boolean);

  if (!targets.includes("name")) {
    throw new ApiError("ستون «نام» باید در نگاشت مشخص شود.", 400);
  }

  for (const target of targets) {
    if (target.startsWith("custom:")) continue;
    if (!allowedTargets.has(target)) {
      throw new ApiError(`ستون مقصد «${target}» برای این نوع Import معتبر نیست.`, 400);
    }
  }

  if (new Set(targets.filter(Boolean)).size !== targets.filter(Boolean).length) {
    throw new ApiError("هر فیلد مقصد فقط می‌تواند به یک ستون فایل متصل شود.", 400);
  }

  const customFields = await listCrmCustomFields(workspaceId, input.entityType);
  const customMap = new Map(customFields.map((field) => [field.id, field]));
  const customIds = mappedCustomFields(input.mapping);

  for (const fieldId of customIds) {
    if (!customMap.has(fieldId)) {
      throw new ApiError("یکی از فیلدهای سفارشی نگاشت‌شده معتبر نیست.", 400);
    }
  }

  const mappedCustomSet = new Set(customIds);
  const missingRequired = customFields.filter(
    (field) => field.isRequired && !mappedCustomSet.has(field.id),
  );

  if (missingRequired.length > 0) {
    throw new ApiError(
      `فیلد اجباری «${missingRequired[0].name}» در فایل نگاشت نشده است.`,
      400,
    );
  }

  const candidateEmails = [...new Set(
    input.rows
      .map((row) => normalizeEmail(valueFromRow(row, input.mapping, "email")))
      .filter((value): value is string => Boolean(value)),
  )];

  const candidatePhones = [...new Set(
    input.rows
      .map((row) => normalizePhone(valueFromRow(row, input.mapping, "phone")))
      .filter((value): value is string => Boolean(value)),
  )];

  const existing = await existingIdentitySets(
    workspaceId,
    input.entityType,
    candidateEmails,
    candidatePhones,
  );

  const batchEmails = new Set<string>();
  const batchPhones = new Set<string>();
  const prepared: PreparedImportRow[] = [];

  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index];
    const rawName = valueFromRow(row, input.mapping, "name").trim();
    const rawEmail = valueFromRow(row, input.mapping, "email");
    const rawPhone = valueFromRow(row, input.mapping, "phone");
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(rawPhone);

    const duplicate =
      Boolean(email && (existing.emails.has(email) || batchEmails.has(email))) ||
      Boolean(phone && (existing.phones.has(phone) || batchPhones.has(phone)));

    if (email) batchEmails.add(email);
    if (phone) batchPhones.add(phone);

    let base: Record<string, unknown>;

    if (input.entityType === "lead") {
      const estimatedValue = numberFromText(
        valueFromRow(row, input.mapping, "estimatedValue"),
      );

      const parsed = createLeadSchema.safeParse({
        name: rawName,
        companyName: valueFromRow(row, input.mapping, "companyName") || null,
        phone: rawPhone.trim() || null,
        email: rawEmail.trim() || null,
        source: valueFromRow(row, input.mapping, "source") || null,
        estimatedValue,
        ownerId: userId,
        notes: valueFromRow(row, input.mapping, "notes") || null,
      });

      if (!parsed.success) {
        prepared.push({
          index,
          status: "invalid",
          reason: parsed.error.issues[0]?.message ?? "اطلاعات ردیف معتبر نیست.",
          isDuplicate: duplicate,
          base: null,
          customValues: {},
          displayName: rawName || `ردیف ${index + 1}`,
          email,
          phone,
        });
        continue;
      }

      base = parsed.data;
    } else {
      const parsed = createCustomerSchema.safeParse({
        name: rawName,
        companyName: valueFromRow(row, input.mapping, "companyName") || null,
        jobTitle: valueFromRow(row, input.mapping, "jobTitle") || null,
        phone: rawPhone.trim() || null,
        email: rawEmail.trim() || null,
        source: valueFromRow(row, input.mapping, "source") || null,
        ownerId: userId,
        notes: valueFromRow(row, input.mapping, "notes") || null,
      });

      if (!parsed.success) {
        prepared.push({
          index,
          status: "invalid",
          reason: parsed.error.issues[0]?.message ?? "اطلاعات ردیف معتبر نیست.",
          isDuplicate: duplicate,
          base: null,
          customValues: {},
          displayName: rawName || `ردیف ${index + 1}`,
          email,
          phone,
        });
        continue;
      }

      base = parsed.data;
    }

    const normalizedCustom: Record<string, Primitive> = {};
    let customError: string | null = null;

    for (const [source, target] of Object.entries(input.mapping)) {
      if (!target.startsWith("custom:")) continue;
      const fieldId = target.slice("custom:".length);
      const field = customMap.get(fieldId);
      if (!field) continue;

      const raw = row[source]?.trim() ?? "";
      let value: Primitive = raw || null;

      if (field.fieldType === "boolean" && raw) {
        const normalized = latinDigits(raw).trim().toLowerCase();
        if (["1", "true", "yes", "بله", "آره"].includes(normalized)) value = true;
        else if (["0", "false", "no", "خیر", "نه"].includes(normalized)) value = false;
      } else if (field.fieldType === "number" && raw) {
        value = numberFromText(raw);
      }

      try {
        normalizedCustom[fieldId] = normalizeCrmCustomFieldValue(field, value);
      } catch (error) {
        customError = error instanceof Error ? error.message : "مقدار فیلد سفارشی معتبر نیست.";
        break;
      }
    }

    if (customError) {
      prepared.push({
        index,
        status: "invalid",
        reason: customError,
        isDuplicate: duplicate,
        base: null,
        customValues: {},
        displayName: rawName || `ردیف ${index + 1}`,
        email,
        phone,
      });
      continue;
    }

    prepared.push({
      index,
      status: duplicate && input.duplicateStrategy === "skip" ? "duplicate" : "ready",
      reason: duplicate ? "ایمیل یا شماره تماس مشابه قبلاً وجود دارد." : null,
      isDuplicate: duplicate,
      base,
      customValues: normalizedCustom,
      displayName: rawName,
      email,
      phone,
    });
  }

  const summary = {
    total: prepared.length,
    ready: prepared.filter((row) => row.status === "ready").length,
    duplicates: prepared.filter((row) => row.status === "duplicate").length,
    invalid: prepared.filter((row) => row.status === "invalid").length,
  };

  if (input.dryRun) {
    return {
      summary,
      rows: prepared.map(({ base: _base, customValues: _customValues, ...row }) => row),
      imported: 0,
    };
  }

  const eligible = prepared.filter(
    (row): row is PreparedImportRow & { base: Record<string, unknown> } =>
      row.status === "ready" && row.base !== null,
  );

  if (eligible.length === 0) {
    return {
      summary,
      rows: prepared.map(({ base: _base, customValues: _customValues, ...row }) => row),
      imported: 0,
    };
  }

  const imported = await db.transaction(async (tx) => {
    let created: { id: string }[] = [];

    if (input.entityType === "lead") {
      created = await tx
        .insert(crmLeads)
        .values(
          eligible.map((row) => ({
            workspaceId,
            name: String(row.base.name),
            companyName: (row.base.companyName as string | null | undefined) ?? null,
            phone: (row.base.phone as string | null | undefined) ?? null,
            email: (row.base.email as string | null | undefined) || null,
            source: (row.base.source as string | null | undefined) ?? null,
            estimatedValue: (row.base.estimatedValue as number | null | undefined) ?? null,
            ownerId: userId,
            notes: (row.base.notes as string | null | undefined) ?? null,
          })),
        )
        .returning({ id: crmLeads.id });
    } else {
      const companyNames = [...new Set(
        eligible
          .map((row) => String(row.base.companyName ?? "").trim())
          .filter(Boolean),
      )];

      const companyMap = new Map<string, string>();

      if (companyNames.length > 0) {
        const existingCompanies = await tx
          .select({ id: crmCompanies.id, name: crmCompanies.name })
          .from(crmCompanies)
          .where(
            and(
              eq(crmCompanies.workspaceId, workspaceId),
              inArray(crmCompanies.name, companyNames),
            ),
          );

        for (const company of existingCompanies) {
          companyMap.set(company.name, company.id);
        }

        const missingNames = companyNames.filter((name) => !companyMap.has(name));
        if (missingNames.length > 0) {
          const insertedCompanies = await tx
            .insert(crmCompanies)
            .values(
              missingNames.map((name) => ({
                workspaceId,
                name,
                ownerId: userId,
              })),
            )
            .returning({ id: crmCompanies.id, name: crmCompanies.name });

          for (const company of insertedCompanies) {
            companyMap.set(company.name, company.id);
          }
        }
      }

      created = await tx
        .insert(crmContacts)
        .values(
          eligible.map((row) => {
            const companyName = String(row.base.companyName ?? "").trim();
            return {
              workspaceId,
              companyId: companyName ? companyMap.get(companyName) ?? null : null,
              name: String(row.base.name),
              jobTitle: (row.base.jobTitle as string | null | undefined) ?? null,
              phone: (row.base.phone as string | null | undefined) ?? null,
              email: (row.base.email as string | null | undefined) || null,
              source: (row.base.source as string | null | undefined) ?? null,
              ownerId: userId,
              notes: (row.base.notes as string | null | undefined) ?? null,
            };
          }),
        )
        .returning({ id: crmContacts.id });
    }

    const customRows: (typeof crmCustomFieldValues.$inferInsert)[] = [];

    eligible.forEach((row, rowIndex) => {
      const entityId = created[rowIndex]?.id;
      if (!entityId) return;

      for (const [fieldId, value] of Object.entries(row.customValues)) {
        if (value === null) continue;
        customRows.push({
          workspaceId,
          fieldId,
          entityType: input.entityType,
          entityId,
          value,
          updatedBy: userId,
        });
      }
    });

    if (customRows.length > 0) {
      await tx.insert(crmCustomFieldValues).values(customRows);
    }

    return created.length;
  });

  return {
    summary,
    rows: prepared.map(({ base: _base, customValues: _customValues, ...row }) => row),
    imported,
  };
}
