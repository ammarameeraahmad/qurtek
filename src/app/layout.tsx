import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Lora } from "next/font/google";
import PwaBootstrap from "@/components/PwaBootstrap";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
});

const lora = Lora({
  weight: ["600", "700"],
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QURTEK",
  description: "Dokumentasi Sampai, Shohibul Tenang",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1d4d3e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${ibmPlexSans.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaBootstrap />
      </body>
    </html>
  );
}
