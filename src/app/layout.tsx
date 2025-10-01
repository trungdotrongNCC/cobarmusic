import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LeftSidebar from "@/components/LeftSidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Music Marketplace",
  description: "A simple music marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* CSS variables cho responsive layout */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root{
                --sidebar-w:256px;
                --bottom-nav-h:0px;
              }
              @media (max-width: 767px){
                :root{
                  --sidebar-w:0px;          /* player/containers không chừa lề trái */
                  --bottom-nav-h:64px;      /* chiều cao bottom nav mobile */
                }
              }
            `,
          }}
        />
        <div className="flex min-h-screen bg-black text-white">
          {/* Sidebar: ẩn trên mobile */}
          <div className="hidden md:block" style={{ width: "var(--sidebar-w)" }}>
            <LeftSidebar />
          </div>

          {/* Main content */}
          <main className="flex-1">{children}</main>

          {/* Bottom nav (mobile only) */}
          <MobileBottomNav />
        </div>

        {/* Toaster để hiển thị toast notification */}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
