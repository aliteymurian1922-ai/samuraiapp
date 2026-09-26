"use client";

import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export type CrmCustomFieldEntity = "lead" | "contact" | "deal";
export type CrmCustomFieldType = "text" | "number" | "date" | "select" | "boolean";

export type CrmCustomField = {
  id: string;
  entityType: CrmCustomFieldEntity;
  name: string;
  fieldType: CrmCustomFieldType;
  options: string[];
  isRequired: boolean;
  isActive: boolean;
  position: number;
};

const ENTITY_LABELS: Record<CrmCustomFieldEntity, string> = {
  lead: "سرنخ",
  contact: "مشتری",
  deal: "فرصت فروش",
};

const TYPE_LABELS: Record<CrmCustomFieldType, string> = {
  text: "متن",
  number: "عدد",
  date: "تاریخ",
  select: "انتخابی",
  boolean: "بله / خیر",
};

function errorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.";
}

export function useCrmCustomFields(entityType?: CrmCustomFieldEntity, includeInactive = false) {
  const query = new URLSearchParams();
  if (entityType) query.set("entityType", entityType);
  if (includeInactive) query.set("includeInactive", "true");

  const suffix = query.toString() ? `?${query.toString()}` : "";

  return useQuery({
    queryKey: ["crm", "custom-fields", entityType ?? "all", includeInactive],
    queryFn: () => api.get<{ fields: CrmCustomField[] }>(`/api/crm/custom-fields${suffix}`),
  });
}

export function readCrmCustomFieldValues(
  form: FormData,
  fields: CrmCustomField[],
): Record<string, string | number | boolean | null> {
  const values: Record<string, string | number | boolean | null> = {};

  for (const field of fields) {
    const raw = form.get(`custom:${field.id}`);

    if (field.fieldType === "boolean") {
      values[field.id] = raw === "true";
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";

    if (!text) {
      values[field.id] = null;
      continue;
    }

    if (field.fieldType === "number") {
      values[field.id] = Number(text);
      continue;
    }

    values[field.id] = text;
  }

  return values;
}

export async function saveCrmCustomFieldValues(
  entityType: CrmCustomFieldEntity,
  entityId: string,
  values: Record<string, string | number | boolean | null>,
) {
  if (Object.keys(values).length === 0) return;

  await api.post("/api/crm/custom-field-values", {
    entityType,
    entityId,
    values,
  });
}

export function CrmCustomFieldsFormSection({
  fields,
}: {
  fields: CrmCustomField[];
}) {
  if (fields.length === 0) return null;

  return (
    <div className="rounded-2xl border border-(--color-border) bg-slate-50/60 p-3">
      <div className="mb-3">
        <p className="text-xs font-bold text-(--color-text)">اطلاعات اختصاصی</p>
        <p className="mt-0.5 text-[11px] text-(--color-muted)">فیلدهایی که برای این Workspace تعریف شده‌اند.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.id} className="block">
            <span className="mb-1.5 block text-xs font-medium text-(--color-text)">
              {field.name}{field.isRequired ? " *" : ""}
            </span>

            {field.fieldType === "select" ? (
              <select
                name={`custom:${field.id}`}
                required={field.isRequired}
                defaultValue=""
                className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm text-(--color-text)"
              >
                <option value="">انتخاب کنید</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : field.fieldType === "boolean" ? (
              <select
                name={`custom:${field.id}`}
                required={field.isRequired}
                defaultValue=""
                className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm text-(--color-text)"
              >
                <option value="">انتخاب کنید</option>
                <option value="true">بله</option>
                <option value="false">خیر</option>
              </select>
            ) : (
              <Input
                name={`custom:${field.id}`}
                type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                required={field.isRequired}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

export function CrmCustomFieldsView() {
  const queryClient = useQueryClient();
  const fields = useCrmCustomFields(undefined, true);
  const [createOpen, setCreateOpen] = useState(false);
  const [entityFilter, setEntityFilter] = useState<CrmCustomFieldEntity | "all">("all");

  const visible = (fields.data?.fields ?? []).filter(
    (field) => entityFilter === "all" || field.entityType === entityFilter,
  );

  async function toggleField(field: CrmCustomField) {
    try {
      await api.patch(`/api/crm/custom-fields/${field.id}`, {
        isActive: !field.isActive,
      });
      await queryClient.invalidateQueries({ queryKey: ["crm", "custom-fields"] });
      toast.success(field.isActive ? "فیلد غیرفعال شد." : "فیلد فعال شد.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-bold text-(--color-text)">فیلدهای سفارشی CRM</p>
          <p className="mt-1 text-xs text-(--color-muted)">اطلاعاتی را تعریف کنید که فقط کسب‌وکار شما به آن نیاز دارد.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>فیلد جدید</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterButton active={entityFilter === "all"} onClick={() => setEntityFilter("all")}>همه</FilterButton>
        {(Object.keys(ENTITY_LABELS) as CrmCustomFieldEntity[]).map((entity) => (
          <FilterButton
            key={entity}
            active={entityFilter === entity}
            onClick={() => setEntityFilter(entity)}
          >
            {ENTITY_LABELS[entity]}
          </FilterButton>
        ))}
      </div>

      {fields.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="هنوز فیلد سفارشی ندارید"
          description="مثلاً برای مشتری «شهر»، برای سرنخ «بودجه» و برای فرصت فروش «نوع قرارداد» بسازید."
          action={<Button size="sm" onClick={() => setCreateOpen(true)}>ساخت اولین فیلد</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((field) => (
            <Card key={field.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-(--color-text)">{field.name}</p>
                    {!field.isActive && <Badge variant="outline">غیرفعال</Badge>}
                    {field.isRequired && <Badge variant="warning">اجباری</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-(--color-muted)">
                    {ENTITY_LABELS[field.entityType]} · {TYPE_LABELS[field.fieldType]}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => toggleField(field)}>
                  {field.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                </Button>
              </div>

              {field.fieldType === "select" && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {field.options.map((option) => (
                    <Badge key={option} variant="outline">{option}</Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <CreateCustomFieldDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ["crm", "custom-fields"] });
        }}
      />
    </div>
  );
}

function CreateCustomFieldDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [fieldType, setFieldType] = useState<CrmCustomFieldType>("text");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const options = String(form.get("options") || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSubmitting(true);
      await api.post("/api/crm/custom-fields", {
        entityType: String(form.get("entityType")),
        name: String(form.get("name") || ""),
        fieldType,
        options: fieldType === "select" ? options : [],
        isRequired: form.get("isRequired") === "on",
      });
      await onCreated();
      toast.success("فیلد سفارشی ساخته شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="فیلد سفارشی جدید" description="این فیلد فقط داخل Workspace شما استفاده می‌شود.">
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-(--color-text)">برای کدام بخش؟</span>
            <select name="entityType" className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
              <option value="lead">سرنخ</option>
              <option value="contact">مشتری</option>
              <option value="deal">فرصت فروش</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-(--color-text)">نام فیلد</span>
            <Input name="name" required placeholder="مثلاً صنعت، شهر، نوع قرارداد..." />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-(--color-text)">نوع فیلد</span>
            <select
              value={fieldType}
              onChange={(event) => setFieldType(event.target.value as CrmCustomFieldType)}
              className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm"
            >
              <option value="text">متن</option>
              <option value="number">عدد</option>
              <option value="date">تاریخ</option>
              <option value="select">انتخابی</option>
              <option value="boolean">بله / خیر</option>
            </select>
          </label>

          {fieldType === "select" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-(--color-text)">گزینه‌ها</span>
              <textarea
                name="options"
                rows={5}
                required
                placeholder={"هر گزینه در یک خط\nمثلاً: فناوری\nپزشکی\nخرده‌فروشی"}
                className="w-full rounded-xl border border-(--color-border) bg-white px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="flex items-center gap-2 rounded-xl border border-(--color-border) bg-white p-3 text-xs">
            <input name="isRequired" type="checkbox" />
            این فیلد هنگام ثبت رکورد اجباری باشد
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ساخت فیلد</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active ? "bg-(--color-primary) text-white" : "border border-(--color-border) bg-white text-(--color-muted)"
      }`}
    >
      {children}
    </button>
  );
}
