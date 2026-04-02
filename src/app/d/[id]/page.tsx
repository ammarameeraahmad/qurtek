
export default function ShohibulPortal({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 bg-green-50 min-h-screen text-center flex flex-col items-center pt-24">
      <h1 className="text-3xl font-bold mb-4 text-green-800">Dokumentasi Qurban Anda</h1>
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
        <p className="text-gray-600 mb-2">ID Qurban: <span className="font-mono font-bold">{params.id}</span></p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-semibold text-gray-800">Status Terkini:</span>
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Menunggu Disembelih</span>
        </div>
      </div>
    </div>
  );
}
