"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { useWorkspace } from "@/lib/workspace-context";
import { can, ROLE_LABELS_FA, type MembershipRole } from "@/lib/permissions";
import { WORKLOAD_LABEL_FA } from "@/lib/workload";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toPersianDigits } from "@/lib/utils";
import { UserPlus, Trash2 } from "lucide-react";

type TeamMember = {
  membershipId: string; userId: string; name: string; email: string; avatarColor: string | null;
  role: MembershipRole; joinedAt: string;
  counts: { total: number; completed: number; overdue: number };
  workload: { level: "low" | "balanced" | "high" | "overloaded"; taskCount: number; assignedMinutes: number } | null;
  totalMinutesTracked: number;
};

const WORKLOAD_VARIANT: Record<string, "default" | "success" | "warning" | "danger"> = {
  low: "default", balanced: "success", high: "warning", overloaded: "danger",
};

export default function TeamPage() {
  const { role } = useWorkspace();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "member" | "viewer">("member");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["team-report"],
    queryFn: () => api.get<{ members: TeamMember[] }>("/api/reports/team"),
  });

  async function invite() {
    setSubmitting(true);
    try {
      await api.post("/api/members", { email, role: inviteRole });
      toast.success("عضو جدید اضافه شد.");
      setInviteOpen(false);
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["team-report"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(membershipId: string, newRole: MembershipRole) {
    try {
      await api.patch(`/api/members/${membershipId}`, { role: newRole });
      queryClient.invalidateQueries({ queryKey: ["team-report"] });
      toast.success("نقش عضو به‌روزرسانی شد.");
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  async function removeMember(membershipId: string) {
    try {
      await api.delete(`/api/members/${membershipId}`);
      queryClient.invalidateQueries({ queryKey: ["team-report"] });
      toast.success("عضو از Workspace حذف شد.");
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  const members = data?.members ?? [];
  const canManage = can(role, "members.manage");
  const canInvite = can(role, "members.invite");
  const canRemove = can(role, "members.remove");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold">تیم</h1>
          <p className="text-xs text-(--color-muted)">اعضا، نقش‌ها و بار کاری تیم</p>
        </div>
        {canInvite && <Button onClick={() => setInviteOpen(true)}><UserPlus className="size-4" /> دعوت عضو</Button>}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <Card key={m.membershipId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={m.name} color={m.avatarColor} size={42} />
                <div>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-(--color-muted)">{m.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-muted)">
                <Badge variant="outline">{toPersianDigits(m.counts.total)} وظیفه</Badge>
                <Badge variant="outline">{toPersianDigits(m.counts.completed)} تکمیل‌شده</Badge>
                {m.counts.overdue > 0 && <Badge variant="danger">{toPersianDigits(m.counts.overdue)} عقب‌افتاده</Badge>}
                {m.workload && <Badge variant={WORKLOAD_VARIANT[m.workload.level]}>بار کاری: {WORKLOAD_LABEL_FA[m.workload.level]}</Badge>}
              </div>

              <div className="flex items-center gap-2">
                {canManage && m.role !== "owner" ? (
                  <Select value={m.role} onValueChange={(v) => changeRole(m.membershipId, v as MembershipRole)}>
                    <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["admin", "manager", "member", "viewer"] as const).map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS_FA[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="primary">{ROLE_LABELS_FA[m.role]}</Badge>
                )}
                {canRemove && m.role !== "owner" && (
                  <Button size="icon" variant="ghost" onClick={() => removeMember(m.membershipId)} aria-label="حذف عضو">
                    <Trash2 className="size-4 text-(--color-danger)" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent title="دعوت عضو جدید" description="ایمیل کاربری که قبلاً در سامورایی ثبت‌نام کرده را وارد کنید.">
          <div className="space-y-4">
            <div>
              <Label htmlFor="invite-email">ایمیل</Label>
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
            </div>
            <div>
              <Label>نقش</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["admin", "manager", "member", "viewer"] as const).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS_FA[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>انصراف</Button>
              <Button loading={submitting} disabled={!email} onClick={invite}>دعوت عضو</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
