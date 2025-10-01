"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { label: string; href?: string; comingSoon?: boolean };

export default function Tabs({
  tabs,
  className = "",
}: {
  tabs: Tab[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div className={`flex items-center gap-6 border-b border-neutral-800 ${className}`}>
      {tabs.map((t) => {
        const active = !t.comingSoon && pathname === t.href;

        if (t.comingSoon) {
          // Tab disabled + tooltip instant
          return (
            <span
              key={t.label}
              aria-disabled="true"
              tabIndex={-1}
              className="relative group py-3 text-sm md:text-base text-neutral-500 cursor-not-allowed select-none"
            >
              {t.label}
              {/* Tooltip */}
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)]
                           whitespace-nowrap rounded-md bg-white/90 text-black text-xs px-2 py-1
                           opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Coming Soon
              </span>
            </span>
          );
        }

        return (
          <Link
            key={t.href}
            href={t.href || "#"}
            className={`py-3 text-sm md:text-base transition relative
              ${active ? "font-semibold text-white" : "text-neutral-400 hover:text-white"}
            `}
          >
            {t.label}
            {active && (
              <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-white rounded-full" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
