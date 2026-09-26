import "server-only";

import { db } from "@/db";
import {
  crmContacts,
  crmCustomFields,
  crmCustomFieldValues,
  crmDeals,
  crmLeads,
} from "@/db/schema";
import { and, asc, eq, inArray, max } from "drizzle-orm";
import { ApiError, NotFoundError } from "@/lib/api-response";
import type {
  CreateCrmCustomFieldInput,
  CrmCustomFieldEntity,
  SetCrmCustomFieldValuesInput,
  UpdateCrmCustomFieldInput,
} from "@/lib/validation/crm-custom-fields";

type CustomValue = string | number | boolean | null;

async function assertEntityExists(
  workspaceId: string,
  entityType: CrmCustomFieldEntity,
  entityId: string,
) {
  if (entityType === "lead") {
    const rows = await db
      .select({ id: crmLeads.id })
      .from(crmLeads)
      .where(and(eq(crmLeads.id, entityId), eq(crmLeads.workspaceId, workspaceId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("سرنخ یافت نشد.");
    return;
  }

  if (entityType === "contact") {
    const rows = await db
      .select({ id: crmContacts.id })
      .from(crmContacts)
      .where(and(eq(crmContacts.id, entityId), eq(crmContacts.workspaceId, workspaceId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("مشتری یافت نشد.");
    return;
  }

  const rows = await db
    .select({ id: crmDeals.id })
    .from(crmDeals)
    .where(and(eq(crmDeals.id, entityId), eq(crmDeals.workspaceId, workspaceId)))
    .limit(1);
  if (!rows[0]) throw new NotFoundError("فرصت فروش یافت نشد.");
}

function normalizeValue(
  field: typeof crmCustomFields.$inferSelect,
  value: CustomValue,
): CustomValue {
  if (value === null || value === "") {
    if (field.isRequired) throw new ApiError(`فیلد «${field.name}» اجباری است.`, 400);
    return null;
  }

  if (field.fieldType === "text") {
    if (typeof value !== "string") throw new ApiError(`مقدار «${field.name}» باید متن باشد.`, 400);
    return value.trim();
  }

  if (field.fieldType === "number") {
    const numberValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new ApiError(`مقدار «${field.name}» باید عدد باشد.`, 400);
    }
    return numberValue;
  }

  if (field.fieldType === "boolean") {
    if (typeof value !== "boolean") {
      throw new ApiError(`مقدار «${field.name}» باید بله/خیر باشد.`, 400);
    }
    return value;
  }

  if (field.fieldType === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new ApiError(`تاریخ «${field.name}» معتبر نیست.`, 400);
    }

    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(`تاریخ «${field.name}» معتبر نیست.`, 400);
    }
    return value;
  }

  if (field.fieldType === "select") {
    if (typeof value !== "string" || !field.options.includes(value)) {
      throw new ApiError(`گزینه انتخاب‌شده برای «${field.name}» معتبر نیست.`, 400);
    }
    return value;
  }

  throw new ApiError("نوع فیلد سفارشی پشتیبانی نمی‌شود.", 400);
}

export async function listCrmCustomFields(
  workspaceId: string,
  entityType?: CrmCustomFieldEntity,
  includeInactive = false,
) {
  const conditions = [eq(crmCustomFields.workspaceId, workspaceId)];

  if (entityType) conditions.push(eq(crmCustomFields.entityType, entityType));
  if (!includeInactive) conditions.push(eq(crmCustomFields.isActive, true));

  return db
    .select()
    .from(crmCustomFields)
    .where(and(...conditions))
    .orderBy(asc(crmCustomFields.entityType), asc(crmCustomFields.position), asc(crmCustomFields.createdAt));
}

export async function createCrmCustomField(
  workspaceId: string,
  userId: string,
  input: CreateCrmCustomFieldInput,
) {
  if (input.fieldType === "select" && input.options.length < 2) {
    throw new ApiError("فیلد انتخابی باید حداقل دو گزینه داشته باشد.", 400);
  }

  const positionRows = await db
    .select({ position: max(crmCustomFields.position) })
    .from(crmCustomFields)
    .where(
      and(
        eq(crmCustomFields.workspaceId, workspaceId),
        eq(crmCustomFields.entityType, input.entityType),
      ),
    );

  const [field] = await db
    .insert(crmCustomFields)
    .values({
      workspaceId,
      entityType: input.entityType,
      name: input.name,
      fieldType: input.fieldType,
      options: input.fieldType === "select" ? input.options : [],
      isRequired: input.isRequired,
      position: (positionRows[0]?.position ?? -1) + 1,
      createdBy: userId,
    })
    .returning();

  return field;
}

export async function updateCrmCustomField(
  workspaceId: string,
  fieldId: string,
  input: UpdateCrmCustomFieldInput,
) {
  const rows = await db
    .select()
    .from(crmCustomFields)
    .where(and(eq(crmCustomFields.id, fieldId), eq(crmCustomFields.workspaceId, workspaceId)))
    .limit(1);

  const existing = rows[0];
  if (!existing) throw new NotFoundError("فیلد سفارشی یافت نشد.");

  if (input.options !== undefined && existing.fieldType === "select" && input.options.length < 2) {
    throw new ApiError("فیلد انتخابی باید حداقل دو گزینه داشته باشد.", 400);
  }

  const patch: Partial<typeof crmCustomFields.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.options !== undefined) patch.options = existing.fieldType === "select" ? input.options : [];
  if (input.isRequired !== undefined) patch.isRequired = input.isRequired;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.position !== undefined) patch.position = input.position;

  const [updated] = await db
    .update(crmCustomFields)
    .set(patch)
    .where(eq(crmCustomFields.id, fieldId))
    .returning();

  return updated;
}

export async function getCrmCustomFieldValues(
  workspaceId: string,
  entityType: CrmCustomFieldEntity,
  entityId: string,
) {
  await assertEntityExists(workspaceId, entityType, entityId);

  const [fields, values] = await Promise.all([
    listCrmCustomFields(workspaceId, entityType),
    db
      .select({
        fieldId: crmCustomFieldValues.fieldId,
        value: crmCustomFieldValues.value,
      })
      .from(crmCustomFieldValues)
      .where(
        and(
          eq(crmCustomFieldValues.workspaceId, workspaceId),
          eq(crmCustomFieldValues.entityType, entityType),
          eq(crmCustomFieldValues.entityId, entityId),
        ),
      ),
  ]);

  const valueMap = new Map(values.map((item) => [item.fieldId, item.value]));

  return fields.map((field) => ({
    ...field,
    value: valueMap.has(field.id) ? valueMap.get(field.id) ?? null : null,
  }));
}

export async function setCrmCustomFieldValues(
  workspaceId: string,
  userId: string,
  input: SetCrmCustomFieldValuesInput,
) {
  await assertEntityExists(workspaceId, input.entityType, input.entityId);

  const fieldIds = Object.keys(input.values);
  if (fieldIds.length === 0) return [];

  const fields = await db
    .select()
    .from(crmCustomFields)
    .where(
      and(
        eq(crmCustomFields.workspaceId, workspaceId),
        eq(crmCustomFields.entityType, input.entityType),
        eq(crmCustomFields.isActive, true),
        inArray(crmCustomFields.id, fieldIds),
      ),
    );

  if (fields.length !== fieldIds.length) {
    throw new ApiError("یک یا چند فیلد سفارشی معتبر نیست.", 400);
  }

  const fieldMap = new Map(fields.map((field) => [field.id, field]));

  return db.transaction(async (tx) => {
    const saved = [];

    for (const [fieldId, rawValue] of Object.entries(input.values)) {
      const field = fieldMap.get(fieldId)!;
      const value = normalizeValue(field, rawValue);

      if (value === null) {
        await tx
          .delete(crmCustomFieldValues)
          .where(
            and(
              eq(crmCustomFieldValues.workspaceId, workspaceId),
              eq(crmCustomFieldValues.fieldId, fieldId),
              eq(crmCustomFieldValues.entityType, input.entityType),
              eq(crmCustomFieldValues.entityId, input.entityId),
            ),
          );
        saved.push({ fieldId, value: null });
        continue;
      }

      const [row] = await tx
        .insert(crmCustomFieldValues)
        .values({
          workspaceId,
          fieldId,
          entityType: input.entityType,
          entityId: input.entityId,
          value,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: [
            crmCustomFieldValues.fieldId,
            crmCustomFieldValues.entityType,
            crmCustomFieldValues.entityId,
          ],
          set: {
            value,
            updatedBy: userId,
            updatedAt: new Date(),
          },
        })
        .returning();

      saved.push(row);
    }

    return saved;
  });
}
