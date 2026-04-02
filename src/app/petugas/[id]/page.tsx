import UploadMediaForm from "@/components/UploadMediaForm";

export default function PetugasUploadPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Upload Dokumentasi Hewan</h1>
      <UploadMediaForm hewanId={params.id} />
    </div>
  );
}
