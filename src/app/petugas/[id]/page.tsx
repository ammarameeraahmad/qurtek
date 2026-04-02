import { redirect } from "next/navigation";

export default async function PetugasUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/petugas?kode=${encodeURIComponent(id)}`);
}
