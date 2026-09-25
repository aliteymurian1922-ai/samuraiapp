"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import { useUIStore } from "@/stores/ui-store";
import { createTaskSchema } from "@/lib/validation/task";
import { api, ClientApiError } from "@/lib/api-client";
import { useProjects, useMembers } from "@/hooks/use-data";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRIORITY_LABELS: Record<string, string> = { critical: "بحرانی", high: "بالا", medium: "متوسط", low: "پایین" };

export function CreateTaskDialog({ defaultProjectId }: { defaultProjectId?: string } = {}) {
  const { createTaskOpen, setCreateTaskOpen } = useUIStore();
  const queryClient = useQueryClient();
  const { data: projectsData } = useProjects();
  const { data: membersData } = useMembers();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createTaskSchema>>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { priority: "medium", projectId: defaultProjectId, tagIds: [] },
  });

  async function onSubmit(values: z.input<typeof createTaskSchema>) {
    try {
      await api.post("/api/tasks", values);
      toast.success("وظیفه ایجاد شد.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCreateTaskOpen(false);
      reset({ priority: "medium", projectId: values.projectId, tagIds: [] });
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  const projects = projectsData?.projects ?? [];
  const members = membersData?.members ?? [];

  return (
    <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
      <DialogContent title="وظیفه جدید" description="یک وظیفه به پروژه اضافه کنید.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="t-title">عنوان وظیفه</Label>
            <Input id="t-title" placeholder="مثلاً طراحی صفحه ورود" {...register("title")} />
            {errors.title && <p className="mt-1 text-xs text-(--color-danger)">{errors.title.message}</p>}
          </div>

          <div>
            <Label>پروژه</Label>
            <Controller
              control={control}
              name="projectId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="انتخاب پروژه" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.projectId && <p className="mt-1 text-xs text-(--color-danger)">پروژه را انتخاب کنید.</p>}
          </div>

          <div>
            <Label htmlFor="t-desc">توضیحات (اختیاری)</Label>
            <Textarea id="t-desc" rows={3} {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>اولویت</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>مسئول (اختیاری)</Label>
              <Controller
                control={control}
                name="assigneeId"
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="بدون مسئول" /></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div>
            <Label>مهلت انجام (اختیاری)</Label>
            <Input type="date" {...register("dueDate", { setValueAs: (v) => (v ? new Date(v).toISOString() : null) })} />
          </div>

          <input type="hidden" value={watch("projectId") ?? ""} readOnly />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateTaskOpen(false)}>انصراف</Button>
            <Button type="submit" loading={isSubmitting}>ایجاد وظیفه</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
