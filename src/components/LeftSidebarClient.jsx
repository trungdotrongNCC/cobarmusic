// src/components/LeftSidebarClient.jsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, BookOpen, LogOut, UserRound } from "lucide-react";

export default function LeftSidebarClient({ me }) {
  const pathname = usePathname();
  const router = useRouter();

  const itemCls = (active) =>
    `flex items-center w-full p-2 rounded-lg transition ${
      active
        ? "bg-gray-800 text-white"
        : "text-gray-300 hover:bg-gray-800 hover:text-white"
    }`;

  const isMarket = pathname === "/" || pathname.startsWith("/songs");
  const isLibrary = pathname.startsWith("/mysongs");

  const isLoggedIn = !!(me && (me.email || me.name));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  const displayName = isLoggedIn ? me.email || me.name || "User" : "Welcome CobarFan";
  const credits = isLoggedIn ? me.credits ?? 0 : 0;

  return (
    <aside
      className="flex flex-col h-screen bg-black text-white border-r border-gray-800"
      style={{ width: "var(--sidebar-w, 256px)" }}
    >
      {/* ===== Top: User info ===== */}
      <div className="p-4 flex items-center space-x-3">
        {/* Avatar: nếu có ảnh thì dùng img, nếu không thì icon đẹp */}
        {isLoggedIn && me?.avatar ? (
          <img
            src={me.avatar}
            alt="avatar"
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
            <UserRound className="w-7 h-7 text-gray-300" />
          </div>
        )}

        <div className="min-w-0">
          <p className="font-semibold truncate">{displayName}</p>
          <span className="text-xs text-gray-400">
            {credits.toLocaleString()} Credits
          </span>
        </div>
      </div>

      {/* ===== Middle: menu ===== */}
      <nav className="px-4 mt-2 space-y-3">
        <Link href="/" className={itemCls(isMarket)}>
          <ShoppingBag className="w-5 h-5 mr-3" />
          <span>Cobar Shop</span>
        </Link>

        <Link href="/mysongs" className={itemCls(isLibrary)}>
          <BookOpen className="w-5 h-5 mr-3" />
          <span>Thư viện</span>
        </Link>

        {/* Chỉ hiện Sign out khi đã login */}
        {isLoggedIn && (
          <button
            onClick={handleLogout}
            className="flex items-center w-full p-2 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span>Sign out</span>
          </button>
        )}
      </nav>
    </aside>
  );
}
