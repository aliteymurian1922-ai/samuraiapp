"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { useMembers } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatJalaliDate } from "@/lib/date";

type ActivityType = "call" | "message" | "email" | "meeting" | "note" | "task";

type Deal = {
  id: string;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  stageColor: string | null;
  stageProbability: number;
  title: string;
  value: number;
  status: "open" | "won" | "lost";
  source: string | null;
  expectedCloseAt: string | null;
  lostReason: string | null;
  wonAt: string | null;
  lostAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
  updatedAt: string;
};

type Stage = {
  id: string;
  name: string;
  color: string | null;
  position: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
};

type Product = {
  productId: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type CustomField = {
  id: string;
  name: string;
  fieldType: "text" | "number" | "date" | "select" | "boolean";
  options: string[];
  isRequired: boolean;
  value: string | number | boolean | null;
};

type Activity = {
  id: string;
  type: ActivityType;
  title: string;
  note: string | null;
  dueAt: string | null;
  completedAt: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  createdAt: string;
};

type Deal360Response = {
  deal: Deal;
  stages: Stage[];
  products: Product[];
  customFields: CustomField[];
  activities: Activity[];
  metrics: {
    weightedValue: number;
    openFollowUps: number;
    nextFollowUpAt: string | null;
    productValue: number;
  };
};

const STATUS_LABEL: Record<Deal["status"], string> = {
  open: "باز",
  won: "برنده",
  lost: "از دست رفته",
};

const TYPE_LABEL: Record<ActivityType, string> = {
  call: "تماس",
  message: "پیام",
  email: "ایمیل",
  meeting: "جلسه",
  note: "یادداشت",
  task: "پیگیری",
};

const moneyFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const numberFa = new Intl.NumberFormat("fa-IR");

function errorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.";
}

function customDisplay(field: CustomField) {
  if (field.value === null || field.value === "") return "ثبت نشده";
  if (field.fieldType === "boolean") return field.value ? "بله" : "خیر";
  if (field.fieldType === "number") return numberFa.format(Number(field.value));
  if (field.fieldType === "date" && typeof field.value === "string") return formatJalaliDate(field.value);
  return String(field.value);
}

export function Deal360({ dealId }: { dealId: string }) {
  const client = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const query = useQuery({
    queryKey: ["crm", "deal", dealId],
    queryFn: () => api.get<Deal360Response>(`/api/crm/deals/${dealId}`),
  });

  const completeActivity = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch(`/api/crm/activities/${id}`, { completed }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["crm", "deal", dealId] }),
        client.invalidateQueries({ queryKey: ["crm", "activities"] }),
        client.invalidateQueries({ queryKey: ["crm", "overview"] }),
      ]);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const createProject = useMutation({
    mutationFn: () => api.post<{ project: { id: string; name: string } }>(
      `/api/crm/deals/${dealId}/project`,
      {},
    ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["crm", "deal", dealId] }),
        client.invalidateQueries({ queryKey: ["crm", "overview"] }),
        client.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      toast.success("پروژه اجرایی از فروش ساخته شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80" />
          <Skeleton className="h-80 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="پرونده فرصت فروش در دسترس نیست"
        description="ممکن است Deal حذف شده باشد یا دسترسی Workspace تغییر کرده باشد."
        action={<Link href="/app/crm"><Button size="sm">بازگشت به CRM</Button></Link>}
      />
    );
  }

  const { deal, stages, products, customFields, activities, metrics } = query.data;
  const openActivities = activities.filter((item) => !item.completedAt);
  const doneActivities = activities.filter((item) => item.completedAt);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link href="/app/crm" className="text-xs font-semibold text-(--color-primary)">بازگشت به CRM</Link>
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-(--color-text)">{deal.title}</h1>
              <Badge variant={deal.status === "won" ? "success" : deal.status === "lost" ? "danger" : "primary"}>
                {STATUS_LABEL[deal.status]}
              </Badge>
              <Badge variant="outline">{deal.stageName}</Badge>
            </div>
            <p className="mt-1 text-xs text-(--color-muted)">
              {deal.companyName || deal.contactName || "بدون مشتری مشخص"}
              {" · "}
              {deal.pipelineName}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {deal.ownerName && <Badge variant="outline">مسئول: {deal.ownerName}</Badge>}
              {deal.source && <Badge variant="outline">منبع: {deal.source}</Badge>}
              <Badge variant="outline">ثبت: {formatJalaliDate(deal.createdAt)}</Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>ویرایش Deal</Button>
          <Button variant="secondary" onClick={() => setCustomOpen(true)}>اطلاعات اختصاصی</Button>
          <Button variant="secondary" onClick={() => setActivityOpen(true)}>پیگیری جدید</Button>
          {deal.status === "won" && (
            deal.projectId ? (
              <Link
                href={`/app/projects/${deal.projectId}`}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white"
              >
                مشاهده پروژه اجرایی
              </Link>
            ) : (
              <Button loading={createProject.isPending} onClick={() => createProject.mutate()}>
                ساخت پروژه اجرایی
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="ارزش Deal" value={moneyFa.format(deal.value)} sub="تومان" />
        <Metric label="احتمال مرحله" value={`${numberFa.format(deal.stageProbability)}٪`} />
        <Metric label="ارزش وزنی" value={moneyFa.format(metrics.weightedValue)} sub="تومان" />
        <Metric label="پیگیری باز" value={metrics.openFollowUps} />
        <Metric label="پیگیری بعدی" value={metrics.nextFollowUpAt ? formatJalaliDate(metrics.nextFollowUpAt, true) : "ثبت نشده"} />
      </div>

      {deal.status === "lost" && deal.lostReason && (
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-xs font-bold text-red-700">دلیل از دست رفتن فروش</p>
          <p className="mt-1 text-sm text-red-800">{deal.lostReason}</p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm font-bold text-(--color-text)">مشتری و مالک Deal</p>
            <div className="mt-4 space-y-3 text-xs">
              <InfoRow label="شرکت" value={deal.companyName} />
              <InfoRow label="مخاطب" value={deal.contactName} />
              <InfoRow label="تلفن" value={deal.contactPhone} />
              <InfoRow label="ایمیل" value={deal.contactEmail} />
              <InfoRow label="مسئول" value={deal.ownerName} />
              <InfoRow label="موعد بستن" value={deal.expectedCloseAt ? formatJalaliDate(deal.expectedCloseAt) : null} />
            </div>

            {deal.contactId && (
              <Link
                href={`/app/crm/customers/${deal.contactId}`}
                className="mt-4 flex h-9 items-center justify-center rounded-xl border border-(--color-border) bg-slate-50 text-xs font-semibold text-(--color-primary)"
              >
                مشاهده پرونده مشتری
              </Link>
            )}
          </Card>

          <Card className="p-4">
            <p className="text-sm font-bold text-(--color-text)">محصولات / خدمات</p>
            {products.length === 0 ? (
              <p className="mt-3 text-xs text-(--color-muted)">محصول مشخصی به این Deal متصل نشده.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {products.map((product) => (
                  <div key={product.productId} className="rounded-xl border border-(--color-border) p-3">
                    <p className="text-xs font-bold text-(--color-text)">{product.name}</p>
                    <p className="mt-1 text-[10px] text-(--color-muted)">
                      {product.sku ? `SKU: ${product.sku} · ` : ""}
                      تعداد {numberFa.format(product.quantity)}
                    </p>
                    <p className="mt-2 text-xs font-extrabold text-(--color-primary)">
                      {moneyFa.format(product.lineTotal)} تومان
                    </p>
                  </div>
                ))}
                <div className="border-t border-(--color-border) pt-3">
                  <InfoRow label="جمع محصولات" value={`${moneyFa.format(metrics.productValue)} تومان`} />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-(--color-text)">اطلاعات اختصاصی</p>
              <button type="button" onClick={() => setCustomOpen(true)} className="text-[11px] font-semibold text-(--color-primary)">ویرایش</button>
            </div>
            {customFields.length === 0 ? (
              <p className="mt-3 text-xs text-(--color-muted)">برای Dealها فیلد سفارشی تعریف نشده.</p>
            ) : (
              <div className="mt-4 space-y-3 text-xs">
                {customFields.map((field) => <InfoRow key={field.id} label={field.name} value={customDisplay(field)} />)}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-(--color-text)">مسیر Pipeline</p>
                <p className="mt-1 text-xs text-(--color-muted)">مرحله فعلی و احتمال تبدیل این فروش.</p>
              </div>
              <Badge variant="primary">{numberFa.format(deal.stageProbability)}٪</Badge>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  className={`min-w-[135px] rounded-xl border p-3 ${
                    stage.id === deal.stageId
                      ? "border-(--color-primary) bg-(--color-primary-soft)"
                      : "border-(--color-border) bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: stage.color ?? "#94a3b8" }} />
                    <p className="text-xs font-bold text-(--color-text)">{stage.name}</p>
                  </div>
                  <p className="mt-2 text-[10px] text-(--color-muted)">{numberFa.format(stage.probability)}٪ احتمال</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-(--color-text)">Timeline فروش</p>
                <p className="mt-1 text-xs text-(--color-muted)">تماس‌ها، جلسات و پیگیری‌های مرتبط با این Deal.</p>
              </div>
              <Button size="sm" onClick={() => setActivityOpen(true)}>پیگیری جدید</Button>
            </div>

            {activities.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="هنوز تعاملی ثبت نشده"
                  description="تماس، جلسه یا کار بعدی این فروش را ثبت کنید."
                  action={<Button size="sm" onClick={() => setActivityOpen(true)}>ثبت تعامل</Button>}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {openActivities.length > 0 && (
                  <Timeline title="در انتظار پیگیری" rows={openActivities} pending={completeActivity.isPending} onToggle={(id) => completeActivity.mutate({ id, completed: true })} />
                )}
                {doneActivities.length > 0 && (
                  <Timeline title="تاریخچه انجام‌شده" rows={doneActivities} pending={completeActivity.isPending} onToggle={(id) => completeActivity.mutate({ id, completed: false })} completed />
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      <EditDealDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        deal={deal}
        stages={stages}
        onSaved={async () => {
          await Promise.all([
            client.invalidateQueries({ queryKey: ["crm", "deal", dealId] }),
            client.invalidateQueries({ queryKey: ["crm", "overview"] }),
          ]);
        }}
      />

      <EditDealCustomFieldsDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        dealId={dealId}
        fields={customFields}
        onSaved={async () => {
          await client.invalidateQueries({ queryKey: ["crm", "deal", dealId] });
        }}
      />

      <DealActivityDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        deal={deal}
        onCreated={async () => {
          await Promise.all([
            client.invalidateQueries({ queryKey: ["crm", "deal", dealId] }),
            client.invalidateQueries({ queryKey: ["crm", "activities"] }),
            client.invalidateQueries({ queryKey: ["crm", "overview"] }),
          ]);
        }}
      />
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] text-(--color-muted)">{label}</p>
      <p className="mt-1.5 text-base font-extrabold text-(--color-text)">{typeof value === "number" ? numberFa.format(value) : value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-(--color-muted)">{label}</span>
      <span className="min-w-0 break-words text-left font-medium text-(--color-text)">{value || "ثبت نشده"}</span>
    </div>
  );
}

function Timeline({
  title,
  rows,
  pending,
  onToggle,
  completed = false,
}: {
  title: string;
  rows: Activity[];
  pending: boolean;
  onToggle: (id: string) => void;
  completed?: boolean;
}) {
  const now = new Date().getTime();

  return (
    <div>
      <p className="mb-2 text-xs font-bold text-(--color-muted)">{title}</p>
      <div className="space-y-2">
        {rows.map((item) => {
          const overdue = Boolean(!item.completedAt && item.dueAt && new Date(item.dueAt).getTime() < now);
          return (
            <div key={item.id} className="rounded-xl border border-(--color-border) p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={overdue ? "danger" : completed ? "success" : "primary"}>{TYPE_LABEL[item.type]}</Badge>
                    {overdue && <Badge variant="danger">عقب‌افتاده</Badge>}
                  </div>
                  <p className="mt-2 font-semibold text-(--color-text)">{item.title}</p>
                  {item.note && <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-(--color-muted)">{item.note}</p>}
                  <p className="mt-2 text-[10px] text-slate-400">
                    {item.assigneeName ? `مسئول: ${item.assigneeName}` : "بدون مسئول"}
                    {" · "}
                    {item.dueAt ? `موعد: ${formatJalaliDate(item.dueAt, true)}` : `ثبت: ${formatJalaliDate(item.createdAt, true)}`}
                  </p>
                </div>
                <Button size="sm" variant={completed ? "secondary" : "success"} loading={pending} onClick={() => onToggle(item.id)}>
                  {completed ? "بازگردانی" : "انجام شد"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditDealDialog({
  open,
  onOpenChange,
  deal,
  stages,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  stages: Stage[];
  onSaved: () => Promise<void>;
}) {
  const { data } = useMembers();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expected = String(form.get("expectedCloseAt") || "");
    const stageId = String(form.get("stageId") || deal.stageId);
    const stage = stages.find((item) => item.id === stageId);

    try {
      setSubmitting(true);
      await api.patch(`/api/crm/deals/${deal.id}`, {
        title: String(form.get("title") || ""),
        value: Number(form.get("value") || 0),
        stageId,
        ownerId: String(form.get("ownerId") || "") || null,
        expectedCloseAt: expected ? new Date(expected).toISOString() : null,
        lostReason: stage?.isLost ? String(form.get("lostReason") || "") || null : null,
      });
      await onSaved();
      toast.success("فرصت فروش به‌روزرسانی شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="ویرایش فرصت فروش" description="مبلغ، مرحله، مسئول و موعد بستن فروش را به‌روزرسانی کنید.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="عنوان"><Input name="title" defaultValue={deal.title} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ارزش فروش"><Input name="value" type="number" min="0" defaultValue={deal.value} /></Field>
            <Field label="مرحله">
              <select name="stageId" defaultValue={deal.stageId} className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
                {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="موعد احتمالی بستن">
              <Input
                name="expectedCloseAt"
                type="date"
                defaultValue={deal.expectedCloseAt ? deal.expectedCloseAt.slice(0, 10) : ""}
              />
            </Field>
            <Field label="مسئول">
              <select name="ownerId" defaultValue={deal.ownerId ?? ""} className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
                <option value="">بدون مسئول</option>
                {(data?.members ?? []).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="دلیل باخت (در صورت انتقال به مرحله از دست رفته)">
            <Textarea name="lostReason" rows={3} defaultValue={deal.lostReason ?? ""} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ذخیره</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDealCustomFieldsDialog({
  open,
  onOpenChange,
  dealId,
  fields,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  fields: CustomField[];
  onSaved: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, string | number | boolean | null> = {};

    for (const field of fields) {
      const raw = form.get(field.id);
      if (field.fieldType === "boolean") values[field.id] = raw === "" || raw === null ? null : raw === "true";
      else if (field.fieldType === "number") {
        const text = String(raw ?? "").trim();
        values[field.id] = text ? Number(text) : null;
      } else {
        const text = String(raw ?? "").trim();
        values[field.id] = text || null;
      }
    }

    try {
      setSubmitting(true);
      await api.post("/api/crm/custom-field-values", {
        entityType: "deal",
        entityId: dealId,
        values,
      });
      await onSaved();
      toast.success("اطلاعات اختصاصی Deal ذخیره شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="اطلاعات اختصاصی Deal">
        {fields.length === 0 ? (
          <EmptyState title="فیلد سفارشی ندارید" description="از تب فیلدهای سفارشی CRM برای Dealها فیلد تعریف کنید." />
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <Field key={field.id} label={field.name}>
                  {field.fieldType === "select" ? (
                    <select name={field.id} defaultValue={field.value === null ? "" : String(field.value)} required={field.isRequired} className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
                      <option value="">انتخاب کنید</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.fieldType === "boolean" ? (
                    <select name={field.id} defaultValue={field.value === null ? "" : field.value ? "true" : "false"} required={field.isRequired} className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
                      <option value="">انتخاب کنید</option>
                      <option value="true">بله</option>
                      <option value="false">خیر</option>
                    </select>
                  ) : (
                    <Input name={field.id} type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"} defaultValue={field.value === null ? "" : String(field.value)} required={field.isRequired} />
                  )}
                </Field>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
              <Button type="submit" loading={submitting}>ذخیره</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DealActivityDialog({
  open,
  onOpenChange,
  deal,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  onCreated: () => Promise<void>;
}) {
  const { data } = useMembers();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dueAt = String(form.get("dueAt") || "");

    try {
      setSubmitting(true);
      await api.post("/api/crm/activities", {
        type: String(form.get("type") || "call"),
        title: String(form.get("title") || ""),
        note: String(form.get("note") || "") || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        assignedTo: String(form.get("assignedTo") || "") || null,
        dealId: deal.id,
        contactId: deal.contactId,
        companyId: deal.companyId,
      });
      await onCreated();
      toast.success("پیگیری Deal ثبت شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="پیگیری جدید Deal" description={`پیگیری برای «${deal.title}» ثبت می‌شود.`}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="نوع">
            <select name="type" defaultValue="call" className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
              {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="عنوان"><Input name="title" required placeholder="مثلاً ارسال نسخه نهایی پیشنهاد قیمت" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="زمان پیگیری"><Input name="dueAt" type="datetime-local" /></Field>
            <Field label="مسئول">
              <select name="assignedTo" defaultValue="" className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
                <option value="">خودم / پیش‌فرض</option>
                {(data?.members ?? []).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="توضیحات"><Textarea name="note" rows={3} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ثبت پیگیری</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-(--color-text)">{label}</span>
      {children}
    </label>
  );
}
