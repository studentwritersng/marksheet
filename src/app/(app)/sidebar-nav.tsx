"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
      {items.map((item) => (
        <NavItemRenderer key={item.label} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

function NavItemRenderer({ item, pathname, nested }: { item: NavItem; pathname: string; nested?: boolean }) {
  const [expanded, setExpanded] = useState(
    item.children?.some((c) => c.href && pathname.startsWith(c.href)) ?? false
  );

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-label-md text-label-md ${
            nested
              ? "text-blue-300 hover:bg-white/10 hover:text-white"
              : "text-blue-200 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          <span className={`material-symbols-outlined text-[16px] transition-transform ${expanded ? "rotate-90" : ""}`}>
            chevron_right
          </span>
        </button>
        {expanded && (
          <div className="ml-2 mt-0.5 space-y-0.5">
            {item.children.map((child) => (
              <NavItemRenderer key={child.label} item={child} pathname={pathname} nested />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = pathname === item.href || (item.href && pathname.startsWith(item.href + "/"));

  return (
    <Link
      href={item.href ?? "#"}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-label-md text-label-md ${
        isActive
          ? "bg-white/15 text-white"
          : nested
            ? "text-blue-300 hover:bg-white/10 hover:text-white"
            : "text-blue-200 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}
