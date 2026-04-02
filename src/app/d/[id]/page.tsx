import PortalClient from "@/components/shohibul/PortalClient";

export default async function ShohibulPortal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PortalClient token={id} />;
}
