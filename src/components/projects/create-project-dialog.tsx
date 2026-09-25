"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUIStore } from "@/stores/ui-store";
import { createProjectSchema } from "@/lib/validation/project";
import type { z } from "zod";
import { api, ClientApiError } from "@/lib/api-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

const PRIORITY_LABELS: Record<string, string> = { critical: "بحرانی", high: "بالا", medium: "متوسط", low: "پایین" };
const COLORS = ["#4f46e5", "#7c3aed", "#0891b2", "#16a34a", "#d97706", "#dc2626"];

export function CreateProjectDialog() {
  const { createProjectOpen, setCreateProjectOpen } = useUIStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [color, setColor] = useState(COLORS[0]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { priority: "medium", color: COLORS[0], memberIds: [] },
  });

  async function onSubmit(values: z.input<typeof createProjectSchema>) {
    try {
      const res = await api.post<{ project: { id: string } }>("/api/projects", { ...values, color });
      toast.success("پروژه ایجاد شد.");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setCreateProjectOpen(false);
      reset();
      router.push(`/app/projects/${res.project.id}`);
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.");
    }
  }

  return (
    <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
      <DialogContent title="پروژه جدید" description="اطلاعات پروژه را وارد کنید.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="p-name">نام پروژه</Label>
            <Input id="p-name" placeholder="مثلاً طراحی وب‌سایت" {...register("name")} />
            {errors.name && <p className="mt-1 text-xs text-(--color-danger)">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="p-desc">توضیحات (اختیاری)</Label>
            <Textarea id="p-desc" rows={3} placeholder="توضیح کوتاهی درباره این پروژه" {...register("description")} />
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
              <Label>مهلت انجام (اختیاری)</Label>
              <Input type="date" {...register("dueDate", { setValueAs: (v) => (v ? new Date(v).toISOString() : null) })} />
            </div>
          </div>
          <div>
            <Label>رنگ پروژه</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full border-2 transition"
                  style={{ background: c, borderColor: color === c ? "#1c1f2b" : "transparent" }}
                  aria-label={`انتخاب رنگ ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateProjectOpen(false)}>انصراف</Button>
            <Button type="submit" loading={isSubmitting}>ایجاد پروژه</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
