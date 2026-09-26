"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
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

type CustomField = {
  id: string;
  name: string;
  fieldType: "text" | "number" | "date" | "select" | "boolean";
  options: string[];
  isRequired: boolean;
  value: string | number | boolean | null;
};

type Customer = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  notes: string | null;
  companyId: string | null;
  companyName: string | null;
  companyIndustry: string | null;
  companyWebsite: string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
};

type Deal = {
  id: string;
  title: string;
  value: number;
  status: "open" | "won" | "lost";
  stageId: string;
  stageName: string;
  stageColor: string | null;
  expectedCloseAt: string | null;
  lostReason: string | null;
  projectId: string | null;
  projectName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
};

type ActivityType = "call" | "message" | "email" | "meeting" | "note" | "task";

type Activity = {
  id: string;
  type: ActivityType;
  title: string;
  note: string | null;
  dueAt: string | null;
  completedAt: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  dealId: string | null;
  contactId: string | null;
  companyId: string | null;
  createdAt: string;
};

type Customer360Response = {
  customer: Customer;
  customFields: CustomField[];
  deals: Deal[];
  activities: Activity[];
  metrics: {
    deals: number;
    openDeals: number;
    wonDeals: number;
    totalWonValue: number;
    openPipelineValue: number;
    openFollowUps: number;
    nextFollowUpAt: string | null;
  };
};

const TYPE_LABEL: Record<ActivityType, string> = {
  call: "تماس",
  message: "پیام",
  email: "ایمیل",
  meeting: "جلسه",
  note: "یادداشت",
  task: "پیگیری",
};

const DEAL_LABEL: Record<Deal["status"], string> = {
  open: "باز",
  won: "برنده",
  lost: "از دست رفته",
};

const numberFa = new Intl.NumberFormat("fa-IR");
const moneyFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

function errorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.";
}

function displayCustomValue(field: CustomField) {
  if (field.value === null || field.value === "") return "ثبت نشده";
  if (field.fieldType === "boolean") return field.value ? "بله" : "خیر";
  if (field.fieldType === "number") return numberFa.format(Number(field.value));
  if (field.fieldType === "date" && typeof field.value === "string") {
    return formatJalaliDate(field.value);
  }
  return String(field.value);
}

export function Customer360({ customerId }: { customerId: string }) {
  const client = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const query = useQuery({
    queryKey: ["crm", "customer", customerId],
    queryFn: () => api.get<Customer360Response>(`/api/crm/customers/${customerId}`),
  });

  const completeActivity = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch(`/api/crm/activities/${id}`, { completed }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["crm", "customer", customerId] }),
        client.invalidateQueries({ queryKey: ["crm", "activities"] }),
        client.invalidateQueries({ queryKey: ["crm", "overview"] }),
      ]);
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
        title="پرونده مشتری در دسترس نیست"
        description="ممکن است مشتری حذف شده باشد یا دسترسی شما به این Workspace تغییر کرده باشد."
        action={<Link href="/app/crm"><Button size="sm">بازگشت به CRM</Button></Link>}
      />
    );
  }

  const { customer, customFields, deals, activities, metrics } = query.data;
  const openActivities = activities.filter((activity) => !activity.completedAt);
  const completedActivities = activities.filter((activity) => activity.completedAt);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link href="/app/crm" className="text-xs font-semibold text-(--color-primary)">
            بازگشت به CRM
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <span className="size-12 shrink-0 rounded-2xl bg-(--color-primary-soft) text-center text-lg font-extrabold leading-[48px] text-(--color-primary)">
              {customer.name.slice(0, 1)}
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-(--color-text)">{customer.name}</h1>
              <p className="mt-1 text-xs text-(--color-muted)">
                {[customer.jobTitle, customer.companyName].filter(Boolean).join(" · ") || "مشتری مستقل"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {customer.ownerName && <Badge variant="primary">مسئول: {customer.ownerName}</Badge>}
                {customer.source && <Badge variant="outline">منبع: {customer.source}</Badge>}
                <Badge variant="outline">از {formatJalaliDate(customer.createdAt)}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setProfileOpen(true)}>ویرایش اطلاعات</Button>
          <Button variant="secondary" onClick={() => setCustomOpen(true)}>اطلاعات اختصاصی</Button>
          <Button onClick={() => setActivityOpen(true)}>پیگیری جدید</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="فرصت فروش" value={metrics.deals} />
        <Metric label="فرصت باز" value={metrics.openDeals} />
        <Metric label="فروش موفق" value={metrics.wonDeals} />
        <Metric label="فروش قطعی" value={moneyFa.format(metrics.totalWonValue)} sub="تومان" />
        <Metric label="Pipeline باز" value={moneyFa.format(metrics.openPipelineValue)} sub="تومان" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm font-bold text-(--color-text)">اطلاعات تماس</p>
            <div className="mt-4 space-y-3 text-xs">
              <InfoRow label="تلفن" value={customer.phone} />
              <InfoRow label="ایمیل" value={customer.email} />
              <InfoRow label="شرکت" value={customer.companyName} />
              <InfoRow label="صنعت" value={customer.companyIndustry} />
              <InfoRow label="وب‌سایت" value={customer.companyWebsite} />
              <InfoRow label="مسئول" value={customer.ownerName} />
            </div>
            {customer.notes && (
              <div className="mt-4 border-t border-(--color-border) pt-3">
                <p className="text-[11px] font-semibold text-(--color-muted)">یادداشت</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-(--color-text)">{customer.notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-(--color-text)">اطلاعات اختصاصی</p>
              <button
                type="button"
                onClick={() => setCustomOpen(true)}
                className="text-[11px] font-semibold text-(--color-primary)"
              >
                ویرایش
              </button>
            </div>
            {customFields.length === 0 ? (
              <p className="mt-3 text-xs text-(--color-muted)">برای مشتری‌ها هنوز فیلد سفارشی تعریف نشده.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {customFields.map((field) => (
                  <InfoRow key={field.id} label={field.name} value={displayCustomValue(field)} />
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <p className="text-sm font-bold text-(--color-text)">پیگیری بعدی</p>
            <p className="mt-3 text-lg font-extrabold text-(--color-text)">
              {metrics.nextFollowUpAt ? formatJalaliDate(metrics.nextFollowUpAt, true) : "ثبت نشده"}
            </p>
            <p className="mt-1 text-xs text-(--color-muted)">
              {numberFa.format(metrics.openFollowUps)} پیگیری باز
            </p>
            <Button className="mt-4 w-full" size="sm" variant="secondary" onClick={() => setActivityOpen(true)}>
              ثبت پیگیری بعدی
            </Button>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-(--color-text)">فرصت‌های فروش</p>
                <p className="mt-1 text-xs text-(--color-muted)">همه Dealهای مستقیم یا مرتبط با شرکت این مشتری.</p>
              </div>
              <Badge variant="outline">{numberFa.format(deals.length)} مورد</Badge>
            </div>

            {deals.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="هنوز فرصتی ثبت نشده"
                  description="از صفحه CRM یک فرصت فروش برای این مشتری ایجاد کنید."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {deals.map((deal) => (
                  <div key={deal.id} className="rounded-xl border border-(--color-border) p-3">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-(--color-text)">{deal.title}</p>
                          <Badge variant={deal.status === "won" ? "success" : deal.status === "lost" ? "danger" : "primary"}>
                            {DEAL_LABEL[deal.status]}
                          </Badge>
                          <Badge variant="outline">{deal.stageName}</Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-(--color-muted)">
                          مسئول: {deal.ownerName || "نامشخص"}
                          {deal.expectedCloseAt ? ` · تاریخ احتمالی: ${formatJalaliDate(deal.expectedCloseAt)}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="text-sm font-extrabold text-(--color-primary)">{moneyFa.format(deal.value)} تومان</p>
                        {deal.projectId && (
                          <Link
                            href={`/app/projects/${deal.projectId}`}
                            className="mt-1 block text-[11px] font-semibold text-emerald-700"
                          >
                            پروژه: {deal.projectName || "مشاهده"}
                          </Link>
                        )}
                      </div>
                    </div>
                    {deal.lostReason && <p className="mt-2 text-[11px] text-(--color-danger)">دلیل از دست رفتن: {deal.lostReason}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-(--color-text)">Timeline ارتباط با مشتری</p>
                <p className="mt-1 text-xs text-(--color-muted)">پیگیری‌های باز و تعاملات تکمیل‌شده در یک جریان.</p>
              </div>
              <Button size="sm" onClick={() => setActivityOpen(true)}>پیگیری جدید</Button>
            </div>

            {activities.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="هنوز تعاملی ثبت نشده"
                  description="اولین تماس، جلسه یا پیگیری را برای این مشتری ثبت کنید."
                  action={<Button size="sm" onClick={() => setActivityOpen(true)}>ثبت تعامل</Button>}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {openActivities.length > 0 && (
                  <TimelineGroup
                    title="در انتظار پیگیری"
                    activities={openActivities}
                    updating={completeActivity.isPending}
                    onToggle={(id) => completeActivity.mutate({ id, completed: true })}
                  />
                )}
                {completedActivities.length > 0 && (
                  <TimelineGroup
                    title="تاریخچه انجام‌شده"
                    activities={completedActivities}
                    updating={completeActivity.isPending}
                    onToggle={(id) => completeActivity.mutate({ id, completed: false })}
                    completed
                  />
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      <EditCustomerDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        customer={customer}
        customerId={customerId}
        onSaved={async () => {
          await Promise.all([
            client.invalidateQueries({ queryKey: ["crm", "customer", customerId] }),
            client.invalidateQueries({ queryKey: ["crm", "customers"] }),
          ]);
        }}
      />

      <EditCustomFieldsDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        customerId={customerId}
        fields={customFields}
        onSaved={async () => {
          await client.invalidateQueries({ queryKey: ["crm", "customer", customerId] });
        }}
      />

      <CustomerActivityDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        customer={customer}
        onCreated={async () => {
          await Promise.all([
            client.invalidateQueries({ queryKey: ["crm", "customer", customerId] }),
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
      <p className="mt-1.5 text-lg font-extrabold text-(--color-text)">
        {typeof value === "number" ? numberFa.format(value) : value}
      </p>
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

function TimelineGroup({
  title,
  activities,
  updating,
  onToggle,
  completed = false,
}: {
  title: string;
  activities: Activity[];
  updating: boolean;
  onToggle: (id: string) => void;
  completed?: boolean;
}) {
  const now = new Date().getTime();

  return (
    <div>
      <p className="mb-2 text-xs font-bold text-(--color-muted)">{title}</p>
      <div className="space-y-2">
        {activities.map((activity) => {
          const overdue = Boolean(
            !activity.completedAt &&
              activity.dueAt &&
              new Date(activity.dueAt).getTime() < now,
          );

          return (
            <div key={activity.id} className="rounded-xl border border-(--color-border) p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={overdue ? "danger" : completed ? "success" : "primary"}>
                      {TYPE_LABEL[activity.type]}
                    </Badge>
                    {overdue && <Badge variant="danger">عقب‌افتاده</Badge>}
                  </div>
                  <p className="mt-2 font-semibold text-(--color-text)">{activity.title}</p>
                  {activity.note && <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-(--color-muted)">{activity.note}</p>}
                  <p className="mt-2 text-[10px] text-slate-400">
                    {activity.assigneeName ? `مسئول: ${activity.assigneeName}` : "بدون مسئول"}
                    {" · "}
                    {activity.dueAt ? `موعد: ${formatJalaliDate(activity.dueAt, true)}` : `ثبت: ${formatJalaliDate(activity.createdAt, true)}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={completed ? "secondary" : "success"}
                  loading={updating}
                  onClick={() => onToggle(activity.id)}
                >
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

function EditCustomerDialog({
  open,
  onOpenChange,
  customer,
  customerId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  customerId: string;
  onSaved: () => Promise<void>;
}) {
  const { data } = useMembers();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      setSubmitting(true);
      await api.patch(`/api/crm/customers/${customerId}`, {
        name: String(form.get("name") || ""),
        jobTitle: String(form.get("jobTitle") || "") || null,
        phone: String(form.get("phone") || "") || null,
        email: String(form.get("email") || "") || null,
        source: String(form.get("source") || "") || null,
        ownerId: String(form.get("ownerId") || "") || null,
        notes: String(form.get("notes") || "") || null,
      });
      await onSaved();
      toast.success("اطلاعات مشتری به‌روزرسانی شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="ویرایش اطلاعات مشتری" description="اطلاعات پایه و مسئول این مشتری را به‌روزرسانی کنید.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="نام"><Input name="name" defaultValue={customer.name} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="سمت"><Input name="jobTitle" defaultValue={customer.jobTitle ?? ""} /></Field>
            <Field label="شماره تماس"><Input name="phone" defaultValue={customer.phone ?? ""} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ایمیل"><Input name="email" type="email" defaultValue={customer.email ?? ""} /></Field>
            <Field label="منبع آشنایی"><Input name="source" defaultValue={customer.source ?? ""} /></Field>
          </div>
          <Field label="مسئول">
            <select
              name="ownerId"
              defaultValue={customer.ownerId ?? ""}
              className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm"
            >
              <option value="">بدون مسئول</option>
              {(data?.members ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>{member.name}</option>
              ))}
            </select>
          </Field>
          <Field label="یادداشت"><Textarea name="notes" rows={4} defaultValue={customer.notes ?? ""} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ذخیره تغییرات</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCustomFieldsDialog({
  open,
  onOpenChange,
  customerId,
  fields,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
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

      if (field.fieldType === "boolean") {
        values[field.id] = raw === "" || raw === null ? null : raw === "true";
      } else if (field.fieldType === "number") {
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
        entityType: "contact",
        entityId: customerId,
        values,
      });
      await onSaved();
      toast.success("اطلاعات اختصاصی ذخیره شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="اطلاعات اختصاصی مشتری" description="فیلدهای سفارشی تعریف‌شده برای مشتری را ویرایش کنید.">
        {fields.length === 0 ? (
          <EmptyState
            title="فیلد سفارشی ندارید"
            description="از تب «فیلدهای سفارشی» در CRM برای مشتری‌ها فیلد تعریف کنید."
          />
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <Field key={field.id} label={field.name}>
                  {field.fieldType === "select" ? (
                    <select
                      name={field.id}
                      defaultValue={field.value === null ? "" : String(field.value)}
                      required={field.isRequired}
                      className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm"
                    >
                      <option value="">انتخاب کنید</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.fieldType === "boolean" ? (
                    <select
                      name={field.id}
                      defaultValue={field.value === null ? "" : field.value ? "true" : "false"}
                      required={field.isRequired}
                      className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm"
                    >
                      <option value="">انتخاب کنید</option>
                      <option value="true">بله</option>
                      <option value="false">خیر</option>
                    </select>
                  ) : (
                    <Input
                      name={field.id}
                      type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                      defaultValue={field.value === null ? "" : String(field.value)}
                      required={field.isRequired}
                    />
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

function CustomerActivityDialog({
  open,
  onOpenChange,
  customer,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
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
        contactId: customer.id,
        companyId: customer.companyId,
      });
      await onCreated();
      toast.success("پیگیری مشتری ثبت شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="پیگیری جدید مشتری" description={`پیگیری برای «${customer.name}» ثبت می‌شود.`}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="نوع">
            <select name="type" defaultValue="call" className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
              {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="عنوان"><Input name="title" required placeholder="مثلاً تماس برای پیگیری پیشنهاد قیمت" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="زمان پیگیری"><Input name="dueAt" type="datetime-local" /></Field>
            <Field label="مسئول">
              <select name="assignedTo" defaultValue="" className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
                <option value="">خودم / پیش‌فرض</option>
                {(data?.members ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>{member.name}</option>
                ))}
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
