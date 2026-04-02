import { redirect } from "next/navigation";

export default async function GaleriHewan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/d/${id}`);
}
