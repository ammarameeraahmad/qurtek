"use client";
import { useState } from "react";
import { uploadMedia } from "@/lib/uploadMedia";

export default function UploadMediaForm({ hewanId }: { hewanId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [tahap, setTahap] = useState("");
  const [jenisMedia, setJenisMedia] = useState("foto");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !tahap) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await uploadMedia({ file, hewanId, tahap, jenisMedia });
      setSuccess(true);
      setFile(null);
      setTahap("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-1">Tahapan Dokumentasi</label>
        <input
          type="text"
          value={tahap}
          onChange={e => setTahap(e.target.value)}
          className="border px-2 py-1 rounded w-full"
          placeholder="Contoh: penyembelihan"
          required
        />
      </div>
      <div>
        <label className="block mb-1">Jenis Media</label>
        <select
          value={jenisMedia}
          onChange={e => setJenisMedia(e.target.value)}
          className="border px-2 py-1 rounded w-full"
        >
          <option value="foto">Foto</option>
          <option value="video">Video</option>
        </select>
      </div>
      <div>
        <label className="block mb-1">File</label>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={e => setFile(e.target.files?.[0] || null)}
          required
        />
      </div>
      <button
        type="submit"
        className="bg-green-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? "Uploading..." : "Upload"}
      </button>
      {success && <div className="text-green-600">Upload berhasil!</div>}
      {error && <div className="text-red-600">{error}</div>}
    </form>
  );
}
