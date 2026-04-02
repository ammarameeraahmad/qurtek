import { supabase } from "@/lib/supabase";

export default async function GaleriHewan({ params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from("dokumentasi")
    .select("*")
    .eq("hewan_id", params.id)
    .order("created_at", { ascending: true });
  if (error) return <div>Error: {error.message}</div>;
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Galeri Dokumentasi Hewan</h1>
      <div className="grid grid-cols-2 gap-4">
        {data?.map((item: any) => (
          <div key={item.id} className="border rounded p-2">
            {item.jenis_media === "foto" ? (
              <img src={supabase.storage.from("qurban_media").getPublicUrl(item.url_media).data.publicUrl} alt="foto" className="w-full h-40 object-cover" />
            ) : (
              <video src={supabase.storage.from("qurban_media").getPublicUrl(item.url_media).data.publicUrl} controls className="w-full h-40 object-cover" />
            )}
            <div className="text-xs mt-1">{item.tipe_tahapan}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
