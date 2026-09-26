import { Customer360 } from "@/components/crm/customer-360";

export const dynamic = "force-dynamic";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Customer360 customerId={id} />;
}
