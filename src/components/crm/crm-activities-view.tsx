"use client";

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
  leadId: string | null;
  dealId: string | null;
  contactId: string | null;
  companyId: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<ActivityType, string> = {
  call: "تماس",
  message: "پیام",
  email: "ایمیل",
  meeting: "جلسه",
  note: "یادداشت",
  task: "پیگیری",
};

function getError(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.";
}

export function CrmActivitiesView() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"open" | "overdue" | "done">("open");

  const query = useQuery({
    queryKey: ["crm", "activities"],
    queryFn: () => api.get<{ activities: Activity[] }>("/api/crm/activities"),
  });

  const update = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api.patch(`/api/crm/activities/${id}`, { completed }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["crm", "activities"] }),
        client.invalidateQueries({ queryKey: ["crm", "overview"] }),
      ]);
    },
    onError: (error) => toast.error(getError(error)),
  });

  const rows = useMemo(() => {
    const now = Date.now();
    return (query.data?.activities ?? []).filter((item) => {
      if (filter === "done") return Boolean(item.completedAt);
      if (item.completedAt) return false;
      if (filter === "overdue") return Boolean(item.dueAt && new Date(item.dueAt).getTime() < now);
      return true;
    });
  }, [query.data, filter]);

  if (query.isLoading) return <Skeleton className="h-72" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-bold text-(--color-text)">پیگیری‌های فروش</h2>
          <p className="mt-1 text-xs text-(--color-muted)">تماس، پیام، جلسه و کار بعدی را ثبت کنید تا هیچ پیگیری‌ای جا نماند.</p>
        </div>
        <Button onClick={() => setOpen(true)}>پیگیری جدید</Button>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-(--color-border) bg-white p-1">
        <FilterButton active={filter === "open"} onClick={() => setFilter("open")}>باز</FilterButton>
        <FilterButton active={filter === "overdue"} onClick={() => setFilter("overdue")}>عقب‌افتاده</FilterButton>
        <FilterButton active={filter === "done"} onClick={() => setFilter("done")}>انجام‌شده</FilterButton>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filter === "overdue" ? "پیگیری عقب‌افتاده‌ای ندارید" : filter === "done" ? "هنوز پیگیری تکمیل‌شده‌ای ندارید" : "پیگیری بازی ندارید"}
          description="پیگیری بعدی مشتری یا فرصت فروش را ثبت کنید تا سامورایی آن را جلوی چشم نگه دارد."
          action={<Button size="sm" onClick={() => setOpen(true)}>ثبت پیگیری</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((item) => {
            const overdue = Boolean(!item.completedAt && item.dueAt && new Date(item.dueAt).getTime() < Date.now());
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={overdue ? "danger" : item.completedAt ? "success" : "primary"}>{TYPE_LABEL[item.type]}</Badge>
                      {overdue && <Badge variant="danger">عقب‌افتاده</Badge>}
                    </div>
                    <p className="mt-2 font-bold text-(--color-text)">{item.title}</p>
                    {item.note && <p className="mt-1 line-clamp-2 text-xs text-(--color-muted)">{item.note}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant={item.completedAt ? "secondary" : "success"}
                    loading={update.isPending}
                    onClick={() => update.mutate({ id: item.id, completed: !item.completedAt })}
                  >
                    {item.completedAt ? "بازگردانی" : "انجام شد"}
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-(--color-border) pt-3 text-[11px] text-slate-500">
                  <span>مسئول: {item.assigneeName || "نامشخص"}</span>
                  <span>{item.dueAt ? `موعد: ${formatJalaliDate(item.dueAt, true)}` : "بدون موعد"}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateActivityDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={async () => {
          await Promise.all([
            client.invalidateQueries({ queryKey: ["crm", "activities"] }),
            client.invalidateQueries({ queryKey: ["crm", "overview"] }),
          ]);
        }}
      />
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${active ? "bg-(--color-primary) text-white" : "text-(--color-muted)"}`}
    >
      {children}
    </button>
  );
}

function CreateActivityDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const { data } = useMembers();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const due = String(form.get("dueAt") || "");

    try {
      setSubmitting(true);
      await api.post("/api/crm/activities", {
        type: String(form.get("type") || "task"),
        title: String(form.get("title") || ""),
        note: String(form.get("note") || "") || null,
        dueAt: due ? new Date(due).toISOString() : null,
        assignedTo: String(form.get("assignedTo") || "") || null,
      });
      await onCreated();
      toast.success("پیگیری ثبت شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="پیگیری جدید" description="کار بعدی را طوری ثبت کنید که از قلم نیفتد.">
        <form onSubmit={submit} className="space-y-3">
          <Field label="نوع پیگیری">
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
