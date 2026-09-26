import { Deal360 } from "@/components/crm/deal-360";

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Deal360 dealId={id} />;
}
