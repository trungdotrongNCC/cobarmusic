"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, BookOpen, LogOut } from "lucide-react";

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  const isLoggedIn = !!me;

  // Nếu chưa login → hiển thị welcome info
  const displayName = isLoggedIn
    ? me?.email || me?.name || "User"
    : "Welcome CobarFan";
  const avatarUrl = isLoggedIn
    ? me?.avatar || "/default-avatar.png"
    : "/default-avatar.png";
  const credits = isLoggedIn ? me?.credits ?? 0 : 0;

  return (
    <aside
      className="flex flex-col h-screen bg-black text-white border-r border-gray-800"
      style={{ width: "var(--sidebar-w, 256px)" }}
    >
      {/* ===== Top: User info ===== */}
      <div className="p-4 flex items-center space-x-3">
        <img
          src={avatarUrl}
          alt="avatar"
          className="w-12 h-12 rounded-full object-cover"
        />
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
          <span>Marketplace</span>
        </Link>

        <Link href="/mysongs" className={itemCls(isLibrary)}>
          <BookOpen className="w-5 h-5 mr-3" />
          <span>Library</span>
        </Link>

        {/* Chỉ hiện Sign out nếu đã login */}
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
