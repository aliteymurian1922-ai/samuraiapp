"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  useCrmCustomFields,
  type CrmCustomFieldEntity,
} from "@/components/crm/crm-custom-fields-view";

type ImportEntity = Extract<CrmCustomFieldEntity, "lead" | "contact">;

type PreviewRow = {
  index: number;
  status: "ready" | "duplicate" | "invalid";
  reason: string | null;
  isDuplicate: boolean;
  displayName: string;
  email: string | null;
  phone: string | null;
};

type ImportResult = {
  summary: {
    total: number;
    ready: number;
    duplicates: number;
    invalid: number;
  };
  rows: PreviewRow[];
  imported: number;
};

type CsvData = {
  headers: string[];
  rows: Record<string, string>[];
};

const STANDARD_FIELDS: Record<
  ImportEntity,
  { value: string; label: string; aliases: string[] }[]
> = {
  lead: [
    { value: "name", label: "نام", aliases: ["نام", "نام سرنخ", "name", "full name", "fullname"] },
    { value: "companyName", label: "شرکت", aliases: ["شرکت", "نام شرکت", "company", "company name"] },
    { value: "phone", label: "شماره تماس", aliases: ["تلفن", "شماره", "شماره تماس", "موبایل", "mobile", "phone"] },
    { value: "email", label: "ایمیل", aliases: ["ایمیل", "email", "e-mail"] },
    { value: "source", label: "منبع", aliases: ["منبع", "source", "lead source"] },
    { value: "estimatedValue", label: "ارزش تقریبی", aliases: ["ارزش", "ارزش تقریبی", "value", "amount", "estimated value"] },
    { value: "notes", label: "یادداشت", aliases: ["یادداشت", "توضیحات", "notes", "note", "description"] },
  ],
  contact: [
    { value: "name", label: "نام", aliases: ["نام", "نام مشتری", "name", "full name", "fullname"] },
    { value: "companyName", label: "شرکت", aliases: ["شرکت", "نام شرکت", "company", "company name"] },
    { value: "jobTitle", label: "سمت", aliases: ["سمت", "عنوان شغلی", "job title", "position", "title"] },
    { value: "phone", label: "شماره تماس", aliases: ["تلفن", "شماره", "شماره تماس", "موبایل", "mobile", "phone"] },
    { value: "email", label: "ایمیل", aliases: ["ایمیل", "email", "e-mail"] },
    { value: "source", label: "منبع", aliases: ["منبع", "source"] },
    { value: "notes", label: "یادداشت", aliases: ["یادداشت", "توضیحات", "notes", "note", "description"] },
  ],
};

function getErrorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "Import انجام نشد.";
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function countDelimiter(line: string, delimiter: string) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    if (!quoted && char === delimiter) count += 1;
  }
  return count;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  return candidates.sort((a, b) => countDelimiter(firstLine, b) - countDelimiter(firstLine, a))[0];
}

export function parseCsv(text: string): CsvData {
  const delimiter = detectDelimiter(text);
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      cell = "";

      if (row.some((item) => item.trim())) matrix.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((item) => item.trim())) matrix.push(row);

  if (matrix.length < 2) {
    throw new Error("فایل باید حداقل یک سطر عنوان و یک سطر داده داشته باشد.");
  }

  const headers = matrix[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  if (headers.some((header) => !header)) {
    throw new Error("یکی از ستون‌های فایل بدون عنوان است.");
  }

  if (new Set(headers.map(normalizeHeader)).size !== headers.length) {
    throw new Error("عنوان ستون‌های CSV نباید تکراری باشد.");
  }

  const rows = matrix.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
  );

  return { headers, rows };
}

function autoMapping(
  entityType: ImportEntity,
  headers: string[],
  customFields: { id: string; name: string }[],
) {
  const mapping: Record<string, string> = {};
  const standard = STANDARD_FIELDS[entityType];

  for (const header of headers) {
    const normalized = normalizeHeader(header);

    const standardMatch = standard.find((field) =>
      field.aliases.some((alias) => normalizeHeader(alias) === normalized),
    );

    if (standardMatch) {
      mapping[header] = standardMatch.value;
      continue;
    }

    const customMatch = customFields.find(
      (field) => normalizeHeader(field.name) === normalized,
    );

    mapping[header] = customMatch ? `custom:${customMatch.id}` : "";
  }

  return mapping;
}

export function CrmImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState<ImportEntity>("lead");
  const fields = useCrmCustomFields(entityType);
  const [csv, setCsv] = useState<CsvData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "create">("skip");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState(false);

  const customFields = fields.data?.fields ?? [];

  const targetOptions = useMemo(
    () => [
      ...STANDARD_FIELDS[entityType].map((field) => ({
        value: field.value,
        label: field.label,
      })),
      ...customFields.map((field) => ({
        value: `custom:${field.id}`,
        label: `اختصاصی: ${field.name}`,
      })),
    ],
    [entityType, customFields],
  );

  function resetPreview() {
    setPreview(null);
  }

  function changeEntity(next: ImportEntity) {
    setEntityType(next);
    setPreview(null);

    if (csv) {
      const compatibleFields = next === entityType ? customFields : [];
      setMapping(autoMapping(next, csv.headers, compatibleFields));
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم فایل CSV باید کمتر از ۲ مگابایت باشد.");
      return;
    }

    try {
      const parsed = parseCsv(await file.text());
      if (parsed.rows.length > 250) {
        toast.error("در هر Import حداکثر ۲۵۰ ردیف قابل پردازش است.");
        return;
      }

      setCsv(parsed);
      setMapping(autoMapping(entityType, parsed.headers, customFields));
      setPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فایل CSV قابل خواندن نیست.");
    }
  }

  async function run(dryRun: boolean) {
    if (!csv) return;

    try {
      setPending(true);
      const response = await api.post<{ result: ImportResult }>("/api/crm/import", {
        entityType,
        rows: csv.rows,
        mapping,
        duplicateStrategy,
        dryRun,
      });

      setPreview(response.result);

      if (!dryRun) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["crm", "overview"] }),
          queryClient.invalidateQueries({ queryKey: ["crm", "leads"] }),
          queryClient.invalidateQueries({ queryKey: ["crm", "customers"] }),
        ]);

        toast.success(
          `${response.result.imported.toLocaleString("fa-IR")} رکورد با موفقیت وارد شد.`,
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Import از CSV"
        description="ابتدا فایل را بررسی کنید، ستون‌ها را نگاشت کنید و بعد از Preview ثبت نهایی را انجام دهید."
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-(--color-text)">نوع اطلاعات</span>
              <select
                value={entityType}
                onChange={(event) => changeEntity(event.target.value as ImportEntity)}
                className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm"
              >
                <option value="lead">سرنخ‌ها</option>
                <option value="contact">مشتریان</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-(--color-text)">رفتار با موارد تکراری</span>
              <select
                value={duplicateStrategy}
                onChange={(event) => {
                  setDuplicateStrategy(event.target.value as "skip" | "create");
                  resetPreview();
                }}
                className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm"
              >
                <option value="skip">رد کردن duplicateها</option>
                <option value="create">ثبت با وجود شباهت</option>
              </select>
            </label>
          </div>

          <label className="block rounded-2xl border border-dashed border-(--color-border) bg-slate-50 p-4 text-center">
            <span className="block text-xs font-semibold text-(--color-text)">فایل CSV را انتخاب کنید</span>
            <span className="mt-1 block text-[11px] text-(--color-muted)">UTF-8 · حداکثر ۲۵۰ ردیف · حداکثر ۲MB</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="mt-3 block w-full text-xs"
              onChange={handleFile}
            />
          </label>

          {csv && (
            <>
              <div className="rounded-2xl border border-(--color-border)">
                <div className="border-b border-(--color-border) px-3 py-2">
                  <p className="text-xs font-bold text-(--color-text)">نگاشت ستون‌ها</p>
                  <p className="mt-0.5 text-[10px] text-(--color-muted)">ستون نام اجباری است. ستون‌های اضافی را روی «نادیده بگیر» بگذارید.</p>
                </div>
                <div className="max-h-72 divide-y divide-(--color-border) overflow-y-auto">
                  {csv.headers.map((header) => (
                    <div key={header} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
                      <span className="truncate text-xs font-medium text-(--color-text)">{header}</span>
                      <span className="text-[10px] text-slate-300">←</span>
                      <select
                        value={mapping[header] ?? ""}
                        onChange={(event) => {
                          setMapping((current) => ({ ...current, [header]: event.target.value }));
                          resetPreview();
                        }}
                        className="h-9 min-w-0 rounded-xl border border-(--color-border) bg-white px-2 text-xs"
                      >
                        <option value="">نادیده بگیر</option>
                        {targetOptions.map((target) => (
                          <option key={target.value} value={target.value}>{target.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-(--color-muted)">
                  {csv.rows.length.toLocaleString("fa-IR")} ردیف برای بررسی
                </p>
                <Button
                  variant="secondary"
                  loading={pending}
                  onClick={() => run(true)}
                >
                  بررسی و Preview
                </Button>
              </div>
            </>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <Stat label="کل" value={preview.summary.total} />
                <Stat label="آماده" value={preview.summary.ready} variant="success" />
                <Stat label="تکراری" value={preview.summary.duplicates} variant="warning" />
                <Stat label="نامعتبر" value={preview.summary.invalid} variant="danger" />
              </div>

              <div className="max-h-64 divide-y divide-(--color-border) overflow-y-auto rounded-2xl border border-(--color-border)">
                {preview.rows.slice(0, 80).map((row) => (
                  <div key={row.index} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-(--color-text)">
                        {row.displayName || `ردیف ${row.index + 1}`}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-(--color-muted)">
                        {[row.phone, row.email, row.reason].filter(Boolean).join(" · ") || "آماده ثبت"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        row.status === "ready"
                          ? "success"
                          : row.status === "duplicate"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {row.status === "ready" ? "آماده" : row.status === "duplicate" ? "تکراری" : "نامعتبر"}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 border-t border-(--color-border) pt-3">
                <Button variant="secondary" onClick={() => onOpenChange(false)}>بستن</Button>
                <Button
                  loading={pending}
                  disabled={preview.summary.ready === 0}
                  onClick={() => run(false)}
                >
                  ثبت {preview.summary.ready.toLocaleString("fa-IR")} رکورد آماده
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 text-center">
      <p className="text-base font-extrabold text-(--color-text)">{value.toLocaleString("fa-IR")}</p>
      <Badge variant={variant === "default" ? "outline" : variant}>{label}</Badge>
    </div>
  );
}
