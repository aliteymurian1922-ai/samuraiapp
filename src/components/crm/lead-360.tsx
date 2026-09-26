"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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

type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "converted";
type ActivityType = "call" | "message" | "email" | "meeting" | "note" | "task";

type Lead = {
  id: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: LeadStatus;
  estimatedValue: number | null;
  ownerId: string | null;
  ownerName: string | null;
  notes: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  dealId: string | null;
  dealTitle: string | null;
  contactId: string | null;
  contactName: string | null;
  companyId: string | null;
  createdAt: string;
};

type Response = {
  lead: Lead;
  score: {
    score: number;
    band: "hot" | "warm" | "cold" | "inactive" | "converted";
    priorityScore: number;
    priorityBand: "urgent" | "high" | "normal" | "low" | "done";
    recommendedAction: string;
    reasons: string[];
    breakdown: {
      status: number;
      value: number;
      completeness: number;
      engagement: number;
      followUp: number;
      freshness: number;
    };
  };
  customFields: CustomField[];
  activities: Activity[];
  conversion: {
    dealId: string | null;
    dealTitle: string | null;
    contactId: string | null;
    contactName: string | null;
  } | null;
  metrics: {
    openFollowUps: number;
    completedActivities: number;
    nextFollowUpAt: string | null;
    lastInteractionAt: string;
  };
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "جدید",
  contacted: "تماس گرفته شد",
  qualified: "واجد شرایط",
  unqualified: "نامناسب",
  converted: "تبدیل شد",
};

const TYPE_LABEL: Record<ActivityType, string> = {
  call: "تماس",
  message: "پیام",
  email: "ایمیل",
  meeting: "جلسه",
  note: "یادداشت",
  task: "پیگیری",
};

const numberFa = new Intl.NumberFormat("fa-IR");
const moneyFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

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

export function Lead360({ leadId }: { leadId: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const query = useQuery({
    queryKey: ["crm", "lead", leadId],
    queryFn: () => api.get<Response>(`/api/crm/leads/${leadId}`),
  });

  const statusMutation = useMutation({
    mutationFn: (status: Exclude<LeadStatus, "converted">) =>
      api.patch(`/api/crm/leads/${leadId}`, { status }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["crm", "lead", leadId] }),
        client.invalidateQueries({ queryKey: ["crm", "leads"] }),
      ]);
      toast.success("وضعیت سرنخ تغییر کرد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const completeActivity = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch(`/api/crm/activities/${id}`, { completed }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["crm", "lead", leadId] }),
        client.invalidateQueries({ queryKey: ["crm", "activities"] }),
        client.invalidateQueries({ queryKey: ["crm", "overview"] }),
      ]);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const convert = useMutation({
    mutationFn: () =>
      api.post<{
        contact: { id: string; name: string };
        deal: { id: string; title: string };
      }>(`/api/crm/leads/${leadId}/convert`, {}),
    onSuccess: async ({ contact }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["crm", "leads"] }),
        client.invalidateQueries({ queryKey: ["crm", "customers"] }),
        client.invalidateQueries({ queryKey: ["crm", "overview"] }),
      ]);
      toast.success("سرنخ به مشتری و فرصت فروش تبدیل شد.");
      router.push(`/app/crm/customers/${contact.id}`);
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
        title="پرونده سرنخ در دسترس نیست"
        description="ممکن است سرنخ حذف شده باشد یا دسترسی Workspace تغییر کرده باشد."
        action={<Link href="/app/crm"><Button size="sm">بازگشت به CRM</Button></Link>}
      />
    );
  }

  const { lead, score, customFields, activities, conversion, metrics } = query.data;
  const openActivities = activities.filter((item) => !item.completedAt);
  const doneActivities = activities.filter((item) => item.completedAt);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link href="/app/crm" className="text-xs font-semibold text-(--color-primary)">بازگشت به CRM</Link>
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-(--color-text)">{lead.name}</h1>
              <Badge variant={lead.status === "converted" ? "success" : lead.status === "unqualified" ? "danger" : lead.status === "qualified" ? "primary" : "outline"}>
                {STATUS_LABEL[lead.status]}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-(--color-muted)">{lead.companyName || "بدون نام شرکت"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lead.ownerName && <Badge variant="outline">مسئول: {lead.ownerName}</Badge>}
              {lead.source && <Badge variant="outline">منبع: {lead.source}</Badge>}
              <Badge variant="outline">ثبت: {formatJalaliDate(lead.createdAt)}</Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setProfileOpen(true)}>ویرایش اطلاعات</Button>
          <Button variant="secondary" onClick={() => setCustomOpen(true)}>اطلاعات اختصاصی</Button>
          <Button variant="secondary" onClick={() => setActivityOpen(true)}>پیگیری جدید</Button>
          {lead.status !== "converted" && (
            <Button loading={convert.isPending} onClick={() => convert.mutate()}>
              تبدیل به مشتری و Deal
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-(--color-text)">Lead Score</p>
              <Badge
                variant={
                  score.band === "hot"
                    ? "primary"
                    : score.band === "warm"
                      ? "warning"
                      : score.band === "converted"
                        ? "success"
                        : score.band === "inactive"
                          ? "danger"
                          : "outline"
                }
              >
                {numberFa.format(score.score)} از ۱۰۰
              </Badge>
            </div>
            <p className="mt-1 text-xs text-(--color-muted)">
              امتیاز از وضعیت فروش، ارزش، کامل‌بودن اطلاعات، تعامل، پیگیری و تازگی سرنخ ساخته می‌شود.
            </p>
          </div>

          <div className="w-full max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-(--color-primary)"
                style={{ width: `${score.score}%` }}
              />
            </div>
          </div>
        </div>

        {score.priorityBand !== "done" && (
          <div className="mt-4 flex flex-col justify-between gap-3 border-y border-(--color-border) py-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-semibold text-(--color-muted)">اقدام پیشنهادی بعدی</p>
              <p className="mt-1 text-sm font-bold text-(--color-text)">{score.recommendedAction}</p>
            </div>
            <Badge variant={score.priorityBand === "urgent" ? "danger" : score.priorityBand === "high" ? "warning" : "outline"}>
              اولویت اقدام {numberFa.format(score.priorityScore)} از ۱۰۰
            </Badge>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <ScorePart label="وضعیت" value={score.breakdown.status} />
          <ScorePart label="ارزش" value={score.breakdown.value} />
          <ScorePart label="اطلاعات" value={score.breakdown.completeness} />
          <ScorePart label="تعامل" value={score.breakdown.engagement} />
          <ScorePart label="پیگیری" value={score.breakdown.followUp} />
          <ScorePart label="تازگی" value={score.breakdown.freshness} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {score.reasons.map((reason) => (
            <div key={reason} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-(--color-muted)">
              {reason}
            </div>
          ))}
        </div>
      </Card>

      {lead.status === "converted" && conversion?.contactId && (
        <Card className="border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-bold text-emerald-800">این سرنخ تبدیل شده است</p>
              <p className="mt-1 text-xs text-emerald-700">
                مشتری: {conversion.contactName || "مشاهده مشتری"}
                {conversion.dealTitle ? ` · فرصت فروش: ${conversion.dealTitle}` : ""}
              </p>
            </div>
            <Link
              href={`/app/crm/customers/${conversion.contactId}`}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-4 text-xs font-semibold text-emerald-700"
            >
              مشاهده پرونده مشتری
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="ارزش تقریبی" value={lead.estimatedValue ? moneyFa.format(lead.estimatedValue) : "نامشخص"} sub={lead.estimatedValue ? "تومان" : undefined} />
        <Metric label="پیگیری باز" value={metrics.openFollowUps} />
        <Metric label="تعامل انجام‌شده" value={metrics.completedActivities} />
        <Metric label="پیگیری بعدی" value={metrics.nextFollowUpAt ? formatJalaliDate(metrics.nextFollowUpAt, true) : "ثبت نشده"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-(--color-text)">اطلاعات سرنخ</p>
              <button type="button" onClick={() => setProfileOpen(true)} className="text-[11px] font-semibold text-(--color-primary)">ویرایش</button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <InfoRow label="تلفن" value={lead.phone} />
              <InfoRow label="ایمیل" value={lead.email} />
              <InfoRow label="شرکت" value={lead.companyName} />
              <InfoRow label="مسئول" value={lead.ownerName} />
              <InfoRow label="آخرین تغییر" value={formatJalaliDate(lead.updatedAt, true)} />
            </div>
            {lead.notes && (
              <div className="mt-4 border-t border-(--color-border) pt-3">
                <p className="text-[11px] font-semibold text-(--color-muted)">یادداشت</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-(--color-text)">{lead.notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <p className="text-sm font-bold text-(--color-text)">وضعیت qualification</p>
            {lead.status === "converted" ? (
              <p className="mt-3 text-xs text-emerald-700">این سرنخ تبدیل شده و وضعیت آن دیگر قابل تغییر نیست.</p>
            ) : (
              <select
                value={lead.status}
                disabled={statusMutation.isPending}
                onChange={(event) => statusMutation.mutate(event.target.value as Exclude<LeadStatus, "converted">)}
                className="mt-3 h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm"
              >
                <option value="new">جدید</option>
                <option value="contacted">تماس گرفته شد</option>
                <option value="qualified">واجد شرایط</option>
                <option value="unqualified">نامناسب</option>
              </select>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-(--color-text)">اطلاعات اختصاصی</p>
              <button type="button" onClick={() => setCustomOpen(true)} className="text-[11px] font-semibold text-(--color-primary)">ویرایش</button>
            </div>
            {customFields.length === 0 ? (
              <p className="mt-3 text-xs text-(--color-muted)">برای سرنخ‌ها فیلد سفارشی تعریف نشده.</p>
            ) : (
              <div className="mt-4 space-y-3 text-xs">
                {customFields.map((field) => (
                  <InfoRow key={field.id} label={field.name} value={customDisplay(field)} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-(--color-text)">Timeline سرنخ</p>
              <p className="mt-1 text-xs text-(--color-muted)">تماس‌ها، جلسات و کارهای بعدی این سرنخ.</p>
            </div>
            <Button size="sm" onClick={() => setActivityOpen(true)}>پیگیری جدید</Button>
          </div>

          {activities.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="هنوز تعاملی ثبت نشده"
                description="اولین تماس یا کار بعدی را برای این سرنخ ثبت کنید."
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

      <EditLeadDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        lead={lead}
        onSaved={async () => {
          await Promise.all([
            client.invalidateQueries({ queryKey: ["crm", "lead", leadId] }),
            client.invalidateQueries({ queryKey: ["crm", "leads"] }),
          ]);
        }}
      />

      <EditLeadCustomFieldsDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        leadId={leadId}
        fields={customFields}
        onSaved={async () => {
          await client.invalidateQueries({ queryKey: ["crm", "lead", leadId] });
        }}
      />

      <LeadActivityDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        lead={lead}
        onCreated={async () => {
          await Promise.all([
            client.invalidateQueries({ queryKey: ["crm", "lead", leadId] }),
            client.invalidateQueries({ queryKey: ["crm", "activities"] }),
            client.invalidateQueries({ queryKey: ["crm", "overview"] }),
          ]);
        }}
      />
    </div>
  );
}

function ScorePart({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className={`text-sm font-extrabold ${value < 0 ? "text-red-600" : "text-(--color-text)"}`}>
        {value > 0 ? "+" : ""}{numberFa.format(value)}
      </p>
      <p className="mt-0.5 text-[10px] text-(--color-muted)">{label}</p>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] text-(--color-muted)">{label}</p>
      <p className="mt-1.5 text-base font-extrabold text-(--color-text)">
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

function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSaved: () => Promise<void>;
}) {
  const { data } = useMembers();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      setSubmitting(true);
      await api.patch(`/api/crm/leads/${lead.id}`, {
        name: String(form.get("name") || ""),
        companyName: String(form.get("companyName") || "") || null,
        phone: String(form.get("phone") || "") || null,
        email: String(form.get("email") || "") || null,
        source: String(form.get("source") || "") || null,
        estimatedValue: form.get("estimatedValue") ? Number(form.get("estimatedValue")) : null,
        ownerId: String(form.get("ownerId") || "") || null,
        notes: String(form.get("notes") || "") || null,
      });
      await onSaved();
      toast.success("اطلاعات سرنخ به‌روزرسانی شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="ویرایش سرنخ" description="اطلاعات و ارزش تقریبی این سرنخ را اصلاح کنید.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="نام"><Input name="name" defaultValue={lead.name} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="شرکت"><Input name="companyName" defaultValue={lead.companyName ?? ""} /></Field>
            <Field label="شماره تماس"><Input name="phone" defaultValue={lead.phone ?? ""} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ایمیل"><Input name="email" type="email" defaultValue={lead.email ?? ""} /></Field>
            <Field label="منبع"><Input name="source" defaultValue={lead.source ?? ""} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ارزش تقریبی"><Input name="estimatedValue" type="number" min="0" defaultValue={lead.estimatedValue ?? ""} /></Field>
            <Field label="مسئول">
              <select name="ownerId" defaultValue={lead.ownerId ?? ""} className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
                <option value="">بدون مسئول</option>
                {(data?.members ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>{member.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="یادداشت"><Textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ذخیره</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditLeadCustomFieldsDialog({
  open,
  onOpenChange,
  leadId,
  fields,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
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
        entityType: "lead",
        entityId: leadId,
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
      <DialogContent title="اطلاعات اختصاصی سرنخ">
        {fields.length === 0 ? (
          <EmptyState title="فیلد سفارشی ندارید" description="از تب فیلدهای سفارشی CRM برای سرنخ‌ها فیلد تعریف کنید." />
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

function LeadActivityDialog({
  open,
  onOpenChange,
  lead,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
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
        leadId: lead.id,
      });
      await onCreated();
      toast.success("پیگیری سرنخ ثبت شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="پیگیری جدید سرنخ" description={`پیگیری برای «${lead.name}» ثبت می‌شود.`}>
        <form onSubmit={submit} className="space-y-3">
          <Field label="نوع">
            <select name="type" defaultValue="call" className="h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm">
              {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="عنوان"><Input name="title" required placeholder="مثلاً تماس برای نیازسنجی" /></Field>
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
