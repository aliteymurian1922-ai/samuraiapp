import { Lead360 } from "@/components/crm/lead-360";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Lead360 leadId={id} />;
}
