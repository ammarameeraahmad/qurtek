
import Link from "next/link"; 
export default function Home() { 
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center bg-gray-50"> 
      <h1 className="text-5xl font-extrabold mb-4 text-green-700 tracking-tight">QURTEK</h1> 
      <p className="text-xl mb-8 text-gray-600 max-w-lg">Dokumentasi Sampai, Shohibul Tenang - Platform Manajemen Dokumentasi Qurban</p> 
      <div className="flex gap-4"> 
        <Link href="/admin" className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition">Panel Admin</Link> 
        <Link href="/petugas" className="px-6 py-3 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition">Portal Petugas</Link> 
      </div> 
    </main>
  ); 
}
