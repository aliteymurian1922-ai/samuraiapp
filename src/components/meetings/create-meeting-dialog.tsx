"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import { useUIStore } from "@/stores/ui-store";
import { createMeetingSchema } from "@/lib/validation/meeting";
import { api, ClientApiError } from "@/lib/api-client";
import { useProjects, useMembers } from "@/hooks/use-data";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateMeetingDialog() {
  const { createMeetingOpen, setCreateMeetingOpen } = useUIStore();
  const queryClient = useQueryClient();
  const { data: projectsData } = useProjects();
  const { data: membersData } = useMembers();

  const defaultStart = new Date(Date.now() + 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 30 * 60 * 1000);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createMeetingSchema>>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      startTime: defaultStart.toISOString(),
      endTime: defaultEnd.toISOString(),
      participantIds: [],
    },
  });

  const participantIds = watch("participantIds") ?? [];

  async function onSubmit(values: z.input<typeof createMeetingSchema>) {
    try {
      await api.post("/api/meetings", values);
      toast.success("جلسه ایجاد شد.");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      setCreateMeetingOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  const projects = projectsData?.projects ?? [];
  const members = membersData?.members ?? [];

  return (
    <Dialog open={createMeetingOpen} onOpenChange={setCreateMeetingOpen}>
      <DialogContent title="جلسه جدید" description="زمان و شرکت‌کنندگان جلسه را مشخص کنید.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="m-title">عنوان جلسه</Label>
            <Input id="m-title" placeholder="مثلاً جلسه هفتگی تیم" {...register("title")} />
            {errors.title && <p className="mt-1 text-xs text-(--color-danger)">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>شروع</Label>
              <Input
                type="datetime-local"
                defaultValue={toLocalInput(defaultStart)}
                onChange={(e) => setValue("startTime", new Date(e.target.value).toISOString())}
              />
            </div>
            <div>
              <Label>پایان</Label>
              <Input
                type="datetime-local"
                defaultValue={toLocalInput(defaultEnd)}
                onChange={(e) => setValue("endTime", new Date(e.target.value).toISOString())}
              />
            </div>
          </div>

          <div>
            <Label>پروژه مرتبط (اختیاری)</Label>
            <Controller
              control={control}
              name="projectId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="بدون پروژه" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label htmlFor="m-agenda">دستور جلسه (اختیاری)</Label>
            <Textarea id="m-agenda" rows={2} {...register("agenda")} />
          </div>

          <div>
            <Label>شرکت‌کنندگان</Label>
            <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-xl border border-(--color-border) p-2">
              {members.map((m) => (
                <label key={m.userId} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] hover:bg-slate-50">
                  <Checkbox
                    checked={participantIds.includes(m.userId)}
                    onCheckedChange={(checked) => {
                      const next = checked ? [...participantIds, m.userId] : participantIds.filter((id) => id !== m.userId);
                      setValue("participantIds", next);
                    }}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateMeetingOpen(false)}>انصراف</Button>
            <Button type="submit" loading={isSubmitting}>ایجاد جلسه</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
