"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, BookOpen } from "lucide-react";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const isMarket = pathname === "/" || pathname.startsWith("/songs");
  const isLibrary = pathname.startsWith("/mysongs");

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/90 backdrop-blur"
      style={{ height: "var(--bottom-nav-h, 64px)" }}
    >
      <div className="max-w-screen-xl mx-auto h-full px-6 flex items-center justify-around">
        <Link
          href="/"
          aria-label="Marketplace"
          className={`p-2 rounded-lg ${isMarket ? "text-white" : "text-neutral-400"}`}
          title="Marketplace"
        >
          <ShoppingBag className="w-6 h-6" />
        </Link>

        <Link
          href="/mysongs"
          aria-label="Library"
          className={`p-2 rounded-lg ${isLibrary ? "text-white" : "text-neutral-400"}`}
          title="Library"
        >
          <BookOpen className="w-6 h-6" />
        </Link>
      </div>
    </nav>
  );
}
