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
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatJalaliDate } from "@/lib/date";
import { CrmActivitiesView } from "@/components/crm/crm-activities-view";
import { CrmProductsView, useCrmProducts, type CrmProduct } from "@/components/crm/crm-products-view";
import { CrmImportDialog } from "@/components/crm/crm-import-dialog";
import {
  CrmCustomFieldsFormSection,
  CrmCustomFieldsView,
  readCrmCustomFieldValues,
  saveCrmCustomFieldValues,
  useCrmCustomFields,
  type CrmCustomField,
} from "@/components/crm/crm-custom-fields-view";

type Deal = {
  id: string;
  pipelineId: string;
  stageId: string;
  companyId: string | null;
  contactId: string | null;
  title: string;
  value: number;
  status: "open" | "won" | "lost";
  ownerId: string | null;
  source: string | null;
  expectedCloseAt: string | null;
  lostReason: string | null;
  projectId: string | null;
  createdAt: string;
  companyName: string | null;
  contactName: string | null;
  ownerName: string | null;
};

type Stage = {
  id: string;
  name: string;
  color: string | null;
  position: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
  deals: Deal[];
};

type Overview = {
  pipeline: { id: string; name: string; isDefault: boolean };
  stages: Stage[];
  metrics: {
    customers: number;
    leads: number;
    activeLeads: number;
    openDeals: number;
    openValue: number;
    weightedPipelineValue: number;
    wonDeals: number;
    wonValue: number;
    conversionRate: number;
    overdueFollowUps: number;
    dueTodayFollowUps: number;
  };
};

type Lead = {
  id: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: "new" | "contacted" | "qualified" | "unqualified" | "converted";
  estimatedValue: number | null;
  ownerId: string | null;
  ownerName: string | null;
  notes: string | null;
  convertedAt: string | null;
  createdAt: string;
};

type Customer = {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  companyId: string | null;
  companyName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  notes: string | null;
  createdAt: string;
};

type Tab = "pipeline" | "leads" | "customers" | "activities" | "products" | "customFields";

const LEAD_STATUS_LABEL: Record<Lead["status"], string> = {
  new: "جدید",
  contacted: "تماس گرفته شد",
  qualified: "واجد شرایط",
  unqualified: "نامناسب",
  converted: "تبدیل شد",
};

const numberFa = new Intl.NumberFormat("fa-IR");
const moneyFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

function getErrorMessage(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد. دوباره تلاش کنید.";
}

export function CrmWorkspace() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [leadOpen, setLeadOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const overview = useQuery({
    queryKey: ["crm", "overview"],
    queryFn: () => api.get<Overview>("/api/crm"),
  });

  const leads = useQuery({
    queryKey: ["crm", "leads"],
    queryFn: () => api.get<{ leads: Lead[] }>("/api/crm/leads"),
  });

  const customers = useQuery({
    queryKey: ["crm", "customers"],
    queryFn: () => api.get<{ customers: Customer[] }>("/api/crm/customers"),
  });

  const products = useCrmProducts();
  const leadCustomFields = useCrmCustomFields("lead");
  const contactCustomFields = useCrmCustomFields("contact");
  const dealCustomFields = useCrmCustomFields("deal");
  const { data: memberData } = useMembers();

  const invalidateCrm = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["crm", "overview"] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "leads"] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "customers"] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "products"] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "activities"] }),
    ]);
  };

  const moveDeal = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      api.patch<{ deal: Deal }>(`/api/crm/deals/${id}`, { stageId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "overview"] });
      toast.success("مرحله فرصت فروش تغییر کرد.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const convertLead = useMutation({
    mutationFn: (id: string) => api.post(`/api/crm/leads/${id}/convert`),
    onSuccess: async () => {
      await invalidateCrm();
      toast.success("سرنخ به مشتری و فرصت فروش تبدیل شد.");
      setTab("pipeline");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateLeadStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Lead["status"] }) =>
      api.patch(`/api/crm/leads/${id}`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "leads"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const createProjectFromDeal = useMutation({
    mutationFn: (id: string) =>
      api.post<{ project: { id: string; name: string } }>(`/api/crm/deals/${id}/project`, {}),
    onSuccess: async ({ project }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      toast.success(`پروژه «${project.name}» ساخته شد.`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const metrics = overview.data?.metrics;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-semibold text-(--color-primary)">فروش و مشتریان</p>
          <h1 className="mt-1 text-xl font-extrabold text-(--color-text)">از اولین سرنخ تا بستن فروش</h1>
          <p className="mt-1 text-xs text-(--color-muted)">مشتری‌ها، پیگیری‌ها و فرصت‌های فروش را در یک مسیر شفاف نگه دارید.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button variant="secondary" onClick={() => setCustomerOpen(true)}>مشتری جدید</Button>
          <Button variant="secondary" onClick={() => setLeadOpen(true)}>سرنخ جدید</Button>
          <Button onClick={() => setDealOpen(true)}>فرصت فروش جدید</Button>
        </div>
      </div>

      {overview.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="مشتریان" value={metrics?.customers ?? 0} sub="مخاطب ثبت‌شده" />
          <MetricCard label="سرنخ‌های فعال" value={metrics?.activeLeads ?? 0} sub={`از ${numberFa.format(metrics?.leads ?? 0)} سرنخ`} />
          <MetricCard label="ارزش فرصت‌های باز" value={moneyFa.format(metrics?.openValue ?? 0)} sub="تومان" />
          <MetricCard label="ارزش وزنی Pipeline" value={moneyFa.format(metrics?.weightedPipelineValue ?? 0)} sub="بر اساس احتمال هر مرحله" />
          <MetricCard label="نرخ برد" value={`${numberFa.format(metrics?.conversionRate ?? 0)}٪`} sub={`${numberFa.format(metrics?.wonDeals ?? 0)} فروش موفق`} />
          <MetricCard label="پیگیری عقب‌افتاده" value={metrics?.overdueFollowUps ?? 0} sub={`${numberFa.format(metrics?.dueTodayFollowUps ?? 0)} مورد برای امروز`} />
        </div>
      )}

      <div className="flex w-fit gap-1 rounded-xl border border-(--color-border) bg-white p-1">
        <TabButton active={tab === "pipeline"} onClick={() => setTab("pipeline")}>Pipeline فروش</TabButton>
        <TabButton active={tab === "leads"} onClick={() => setTab("leads")}>سرنخ‌ها</TabButton>
        <TabButton active={tab === "customers"} onClick={() => setTab("customers")}>مشتریان</TabButton>
        <TabButton active={tab === "activities"} onClick={() => setTab("activities")}>پیگیری‌ها</TabButton>
        <TabButton active={tab === "products"} onClick={() => setTab("products")}>محصولات / خدمات</TabButton>
        <TabButton active={tab === "customFields"} onClick={() => setTab("customFields")}>فیلدهای سفارشی</TabButton>
      </div>

      {tab === "pipeline" && (
        <PipelineView
          overview={overview.data}
          isLoading={overview.isLoading}
          onMove={(id, stageId) => moveDeal.mutate({ id, stageId })}
          moving={moveDeal.isPending}
          onCreate={() => setDealOpen(true)}
          onCreateProject={(id) => createProjectFromDeal.mutate(id)}
          creatingProject={createProjectFromDeal.isPending}
        />
      )}

      {tab === "leads" && (
        <LeadsView
          leads={leads.data?.leads ?? []}
          isLoading={leads.isLoading}
          onCreate={() => setLeadOpen(true)}
          onConvert={(id) => convertLead.mutate(id)}
          converting={convertLead.isPending}
          onStatusChange={(id, status) => updateLeadStatus.mutate({ id, status })}
        />
      )}

      {tab === "customers" && (
        <CustomersView
          customers={customers.data?.customers ?? []}
          isLoading={customers.isLoading}
          onCreate={() => setCustomerOpen(true)}
        />
      )}

      {tab === "activities" && <CrmActivitiesView />}
      {tab === "products" && <CrmProductsView />}
      {tab === "customFields" && <CrmCustomFieldsView />}

      <CrmImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <LeadDialog
        open={leadOpen}
        onOpenChange={setLeadOpen}
        members={memberData?.members ?? []}
        customFields={leadCustomFields.data?.fields ?? []}
        onCreated={invalidateCrm}
      />
      <CustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        members={memberData?.members ?? []}
        customFields={contactCustomFields.data?.fields ?? []}
        onCreated={invalidateCrm}
      />
      <DealDialog
        open={dealOpen}
        onOpenChange={setDealOpen}
        overview={overview.data}
        customers={customers.data?.customers ?? []}
        products={products.data?.products ?? []}
        members={memberData?.members ?? []}
        customFields={dealCustomFields.data?.fields ?? []}
        onCreated={invalidateCrm}
      />
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium text-(--color-muted)">{label}</p>
      <p className="mt-1.5 text-xl font-extrabold text-(--color-text)">{typeof value === "number" ? numberFa.format(value) : value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{sub}</p>
    </Card>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-(--color-primary) text-white" : "text-(--color-muted) hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}

function PipelineView({
  overview,
  isLoading,
  onMove,
  moving,
  onCreate,
  onCreateProject,
  creatingProject,
}: {
  overview?: Overview;
  isLoading: boolean;
  onMove: (id: string, stageId: string) => void;
  moving: boolean;
  onCreate: () => void;
  onCreateProject: (id: string) => void;
  creatingProject: boolean;
}) {
  if (isLoading) {
    return <div className="flex gap-3 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 min-w-[270px] flex-1" />)}</div>;
  }

  if (!overview) return null;

  const totalDeals = overview.stages.reduce((sum, stage) => sum + stage.deals.length, 0);

  if (totalDeals === 0) {
    return (
      <EmptyState
        title="هنوز فرصت فروشی ندارید"
        description="اولین فرصت فروش را ثبت کنید یا یک سرنخ را به فرصت تبدیل کنید."
        action={<Button size="sm" onClick={onCreate}>ایجاد اولین فرصت</Button>}
      />
    );
  }

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex min-w-max gap-3">
        {overview.stages.map((stage) => {
          const stageValue = stage.deals.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0);
          return (
            <div key={stage.id} className="w-[285px] shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: stage.color ?? "#94a3b8" }} />
                  <h3 className="text-xs font-bold text-(--color-text)">{stage.name}</h3>
                  <span className="text-[10px] text-slate-400">{numberFa.format(stage.deals.length)}</span>
                </div>
                <span className="text-[10px] text-(--color-muted)">{moneyFa.format(stageValue)}</span>
              </div>

              <div className="min-h-[280px] space-y-2 rounded-2xl border border-(--color-border) bg-slate-100/65 p-2">
                {stage.deals.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/60 text-[11px] text-slate-400">
                    فرصت فعالی نیست
                  </div>
                ) : (
                  stage.deals.map((deal) => (
                    <Card key={deal.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-(--color-text)">{deal.title}</p>
                          <p className="mt-0.5 truncate text-[11px] text-(--color-muted)">
                            {deal.companyName || deal.contactName || "بدون مشتری"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-extrabold text-(--color-primary)">{moneyFa.format(deal.value ?? 0)}</span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] text-slate-400">{deal.ownerName || "بدون مسئول"}</span>
                        {deal.expectedCloseAt && <span className="text-[10px] text-slate-400">{formatJalaliDate(deal.expectedCloseAt)}</span>}
                      </div>

                      <select
                        aria-label="انتقال فرصت به مرحله دیگر"
                        value={deal.stageId}
                        disabled={moving}
                        onChange={(event) => onMove(deal.id, event.target.value)}
                        className="mt-3 h-8 w-full rounded-lg border border-(--color-border) bg-white px-2 text-[11px] text-(--color-muted)"
                      >
                        {overview.stages.map((target) => (
                          <option key={target.id} value={target.id}>{target.name}</option>
                        ))}
                      </select>

                      {stage.isWon && (
                        <div className="mt-2">
                          {deal.projectId ? (
                            <Link
                              href={`/app/projects/${deal.projectId}`}
                              className="flex h-8 items-center justify-center rounded-lg bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            >
                              مشاهده پروژه اجرایی
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              loading={creatingProject}
                              onClick={() => onCreateProject(deal.id)}
                            >
                              ساخت پروژه اجرایی
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeadsView({
  leads,
  isLoading,
  onCreate,
  onConvert,
  converting,
  onStatusChange,
}: {
  leads: Lead[];
  isLoading: boolean;
  onCreate: () => void;
  onConvert: (id: string) => void;
  converting: boolean;
  onStatusChange: (id: string, status: Lead["status"]) => void;
}) {
  if (isLoading) return <Skeleton className="h-72" />;

  if (leads.length === 0) {
    return (
      <EmptyState
        title="هنوز سرنخی ثبت نشده"
        description="سرنخ یعنی فرد یا شرکتی که هنوز مشتری نشده اما احتمال خرید دارد."
        action={<Button size="sm" onClick={onCreate}>ثبت اولین سرنخ</Button>}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {leads.map((lead) => (
        <Card key={lead.id} className="p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-(--color-text)">{lead.name}</p>
                <Badge variant={lead.status === "converted" ? "success" : lead.status === "unqualified" ? "danger" : lead.status === "qualified" ? "primary" : "outline"}>
                  {LEAD_STATUS_LABEL[lead.status]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-(--color-muted)">{lead.companyName || "بدون نام شرکت"}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                {lead.phone && <span>{lead.phone}</span>}
                {lead.email && <span>{lead.email}</span>}
                {lead.source && <span>منبع: {lead.source}</span>}
                {lead.ownerName && <span>مسئول: {lead.ownerName}</span>}
              </div>
            </div>

            <div className="shrink-0 text-left">
              <p className="text-xs font-extrabold text-(--color-primary)">
                {lead.estimatedValue ? `${moneyFa.format(lead.estimatedValue)} تومان` : "ارزش نامشخص"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">{formatJalaliDate(lead.createdAt)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-(--color-border) pt-3">
            <select
              value={lead.status}
              onChange={(event) => onStatusChange(lead.id, event.target.value as Lead["status"])}
              disabled={lead.status === "converted"}
              className="h-8 rounded-lg border border-(--color-border) bg-white px-2 text-[11px] text-(--color-muted)"
            >
              {Object.entries(LEAD_STATUS_LABEL).filter(([value]) => value !== "converted").map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
              {lead.status === "converted" && <option value="converted">تبدیل شد</option>}
            </select>

            {lead.status !== "converted" && (
              <Button size="sm" onClick={() => onConvert(lead.id)} loading={converting}>
                تبدیل به فرصت فروش
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CustomersView({
  customers,
  isLoading,
  onCreate,
}: {
  customers: Customer[];
  isLoading: boolean;
  onCreate: () => void;
}) {
  if (isLoading) return <Skeleton className="h-72" />;

  if (customers.length === 0) {
    return (
      <EmptyState
        title="هنوز مشتری‌ای ثبت نشده"
        description="اطلاعات مشتری‌ها را اینجا نگه دارید تا بعداً فروش، پروژه و پیگیری‌ها به آن‌ها متصل شوند."
        action={<Button size="sm" onClick={onCreate}>ثبت اولین مشتری</Button>}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {customers.map((customer) => (
        <Card key={customer.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-(--color-text)">{customer.name}</p>
              <p className="mt-1 truncate text-xs text-(--color-muted)">
                {[customer.jobTitle, customer.companyName].filter(Boolean).join(" · ") || "مشتری مستقل"}
              </p>
            </div>
            <span className="size-9 shrink-0 rounded-xl bg-(--color-primary-soft) text-center text-sm font-extrabold leading-9 text-(--color-primary)">
              {customer.name.slice(0, 1)}
            </span>
          </div>

          <div className="mt-4 space-y-1.5 text-[11px] text-slate-500">
            {customer.phone && <p>{customer.phone}</p>}
            {customer.email && <p className="truncate">{customer.email}</p>}
            {customer.ownerName && <p>مسئول: {customer.ownerName}</p>}
            {customer.source && <p>منبع آشنایی: {customer.source}</p>}
          </div>

          <Link
            href={`/app/crm/customers/${customer.id}`}
            className="mt-4 flex h-9 items-center justify-center rounded-xl border border-(--color-border) bg-slate-50 text-xs font-semibold text-(--color-primary) transition hover:bg-(--color-primary-soft)"
          >
            مشاهده پرونده مشتری
          </Link>
        </Card>
      ))}
    </div>
  );
}

function LeadDialog({
  open,
  onOpenChange,
  members,
  customFields,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: { userId: string; name: string }[];
  customFields: CrmCustomField[];
  onCreated: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customValues = readCrmCustomFieldValues(form, customFields);

    try {
      setSubmitting(true);
      const response = await api.post<{ lead: { id: string } }>("/api/crm/leads", {
        name: String(form.get("name") || ""),
        companyName: String(form.get("companyName") || "") || null,
        phone: String(form.get("phone") || "") || null,
        email: String(form.get("email") || "") || null,
        source: String(form.get("source") || "") || null,
        estimatedValue: form.get("estimatedValue") ? Number(form.get("estimatedValue")) : null,
        ownerId: String(form.get("ownerId") || "") || null,
        notes: String(form.get("notes") || "") || null,
      });

      try {
        await saveCrmCustomFieldValues("lead", response.lead.id, customValues);
        toast.success("سرنخ ثبت شد.");
      } catch {
        toast.warning("سرنخ ثبت شد، اما اطلاعات اختصاصی کامل ذخیره نشد.");
      }

      await onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="سرنخ جدید" description="اطلاعات اولیه فرد یا شرکتی که احتمال خرید دارد.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="نام"><Input name="name" required placeholder="مثلاً علی رضایی" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="شرکت"><Input name="companyName" placeholder="اختیاری" /></Field>
            <Field label="شماره تماس"><Input name="phone" inputMode="tel" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ایمیل"><Input name="email" type="email" /></Field>
            <Field label="منبع آشنایی"><Input name="source" placeholder="اینستاگرام، سایت، معرفی..." /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ارزش تقریبی (تومان)"><Input name="estimatedValue" type="number" min="0" /></Field>
            <Field label="مسئول">
              <NativeSelect name="ownerId" defaultValue="">
                <option value="">خودم / پیش‌فرض</option>
                {members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label="یادداشت"><Textarea name="notes" rows={3} /></Field>
          <CrmCustomFieldsFormSection fields={customFields} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ثبت سرنخ</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDialog({
  open,
  onOpenChange,
  members,
  customFields,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: { userId: string; name: string }[];
  customFields: CrmCustomField[];
  onCreated: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customValues = readCrmCustomFieldValues(form, customFields);

    try {
      setSubmitting(true);
      const response = await api.post<{ customer: { id: string } }>("/api/crm/customers", {
        name: String(form.get("name") || ""),
        companyName: String(form.get("companyName") || "") || null,
        jobTitle: String(form.get("jobTitle") || "") || null,
        phone: String(form.get("phone") || "") || null,
        email: String(form.get("email") || "") || null,
        source: String(form.get("source") || "") || null,
        ownerId: String(form.get("ownerId") || "") || null,
        notes: String(form.get("notes") || "") || null,
      });

      try {
        await saveCrmCustomFieldValues("contact", response.customer.id, customValues);
        toast.success("مشتری ثبت شد.");
      } catch {
        toast.warning("مشتری ثبت شد، اما اطلاعات اختصاصی کامل ذخیره نشد.");
      }

      await onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="مشتری جدید" description="اطلاعات فرد و در صورت نیاز شرکت او را ثبت کنید.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="نام مشتری"><Input name="name" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="شرکت"><Input name="companyName" /></Field>
            <Field label="سمت"><Input name="jobTitle" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="شماره تماس"><Input name="phone" inputMode="tel" /></Field>
            <Field label="ایمیل"><Input name="email" type="email" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="منبع آشنایی"><Input name="source" /></Field>
            <Field label="مسئول">
              <NativeSelect name="ownerId" defaultValue="">
                <option value="">خودم / پیش‌فرض</option>
                {members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label="یادداشت"><Textarea name="notes" rows={3} /></Field>
          <CrmCustomFieldsFormSection fields={customFields} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ثبت مشتری</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DealDialog({
  open,
  onOpenChange,
  overview,
  customers,
  products,
  members,
  customFields,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview?: Overview;
  customers: Customer[];
  products: CrmProduct[];
  members: { userId: string; name: string }[];
  customFields: CrmCustomField[];
  onCreated: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customerId = String(form.get("customerId") || "");
    const customer = customerId ? customerById.get(customerId) : undefined;
    const date = String(form.get("expectedCloseAt") || "");
    const customValues = readCrmCustomFieldValues(form, customFields);

    try {
      setSubmitting(true);
      const response = await api.post<{ deal: { id: string } }>("/api/crm/deals", {
        title: String(form.get("title") || ""),
        value: Number(form.get("value") || 0),
        contactId: customer?.id ?? null,
        companyId: customer?.companyId ?? null,
        stageId: String(form.get("stageId") || "") || null,
        ownerId: String(form.get("ownerId") || "") || null,
        source: String(form.get("source") || "") || null,
        expectedCloseAt: date ? new Date(date).toISOString() : null,
        productId: String(form.get("productId") || "") || null,
        quantity: Number(form.get("quantity") || 1),
      });

      try {
        await saveCrmCustomFieldValues("deal", response.deal.id, customValues);
        toast.success("فرصت فروش ایجاد شد.");
      } catch {
        toast.warning("فرصت فروش ساخته شد، اما اطلاعات اختصاصی کامل ذخیره نشد.");
      }

      await onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="فرصت فروش جدید" description="یک فروش احتمالی را وارد Pipeline کنید.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="عنوان فرصت"><Input name="title" required placeholder="مثلاً قرارداد طراحی سایت شرکت..." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مبلغ (تومان)"><Input name="value" type="number" min="0" defaultValue="0" /></Field>
            <Field label="مرحله فروش">
              <NativeSelect name="stageId" defaultValue={overview?.stages[0]?.id ?? ""}>
                {overview?.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مشتری">
              <NativeSelect name="customerId" defaultValue="">
                <option value="">بدون مشتری</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}{customer.companyName ? ` · ${customer.companyName}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="مسئول فروش">
              <NativeSelect name="ownerId" defaultValue="">
                <option value="">خودم / پیش‌فرض</option>
                {members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="محصول / خدمت">
              <NativeSelect name="productId" defaultValue="">
                <option value="">بدون محصول مشخص</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {moneyFa.format(product.unitPrice)} تومان
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="تعداد"><Input name="quantity" type="number" min="1" max="999" defaultValue="1" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="منبع"><Input name="source" placeholder="سایت، معرفی، تبلیغات..." /></Field>
            <Field label="تاریخ احتمالی نهایی‌شدن"><Input name="expectedCloseAt" type="date" /></Field>
          </div>
          <CrmCustomFieldsFormSection fields={customFields} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ایجاد فرصت</Button>
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

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-xl border border-(--color-border) bg-white px-3 text-sm text-(--color-text) focus:border-(--color-primary) focus:ring-2 focus:ring-indigo-100 ${props.className ?? ""}`}
    />
  );
}
