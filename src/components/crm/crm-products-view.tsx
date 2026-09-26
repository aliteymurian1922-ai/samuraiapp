"use client";

import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ClientApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export type CrmProduct = {
  id: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
};

const money = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

function getError(error: unknown) {
  return error instanceof ClientApiError ? error.message : "مشکلی پیش آمد.";
}

export function useCrmProducts() {
  return useQuery({
    queryKey: ["crm", "products"],
    queryFn: () => api.get<{ products: CrmProduct[] }>("/api/crm/products"),
  });
}

export function CrmProductsView() {
  const client = useQueryClient();
  const query = useCrmProducts();
  const [open, setOpen] = useState(false);

  if (query.isLoading) return <Skeleton className="h-72" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-bold text-(--color-text)">محصولات و خدمات</h2>
          <p className="mt-1 text-xs text-(--color-muted)">چیزهایی که می‌فروشید را یک‌بار تعریف کنید و بعد داخل فرصت‌های فروش استفاده کنید.</p>
        </div>
        <Button onClick={() => setOpen(true)}>محصول / خدمت جدید</Button>
      </div>

      {(query.data?.products ?? []).length === 0 ? (
        <EmptyState
          title="هنوز محصول یا خدمتی ثبت نشده"
          description="اولین مورد را ثبت کنید تا مبلغ فرصت‌های فروش سریع‌تر محاسبه شود."
          action={<Button size="sm" onClick={() => setOpen(true)}>ثبت اولین مورد</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {query.data?.products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-(--color-text)">{product.name}</p>
                  <p className="mt-1 text-[11px] text-(--color-muted)">{product.sku ? `کد: ${product.sku}` : "بدون کد محصول"}</p>
                </div>
                <p className="shrink-0 text-sm font-extrabold text-(--color-primary)">{money.format(product.unitPrice)} تومان</p>
              </div>
              {product.description && <p className="mt-3 line-clamp-3 text-xs text-(--color-muted)">{product.description}</p>}
            </Card>
          ))}
        </div>
      )}

      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={async () => {
          await client.invalidateQueries({ queryKey: ["crm", "products"] });
        }}
      />
    </div>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      setSubmitting(true);
      await api.post("/api/crm/products", {
        name: String(form.get("name") || ""),
        sku: String(form.get("sku") || "") || null,
        unitPrice: Number(form.get("unitPrice") || 0),
        description: String(form.get("description") || "") || null,
      });
      await onCreated();
      toast.success("محصول یا خدمت ثبت شد.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="محصول یا خدمت جدید" description="نام و قیمت پایه را ثبت کنید.">
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">نام</span>
            <Input name="name" required placeholder="مثلاً طراحی وب‌سایت شرکتی" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">کد (اختیاری)</span>
              <Input name="sku" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">قیمت پایه (تومان)</span>
              <Input name="unitPrice" type="number" min="0" defaultValue="0" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">توضیحات</span>
            <Textarea name="description" rows={3} />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button type="submit" loading={submitting}>ثبت</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
