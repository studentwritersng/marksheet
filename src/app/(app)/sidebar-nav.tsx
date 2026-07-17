"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  return (
    <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
      {items.map((item) => (
        <NavItemRenderer
          key={item.label}
          item={item}
          pathname={pathname}
          openLabel={openLabel}
          onToggle={setOpenLabel}
        />
      ))}
    </nav>
  );
}

function NavItemRenderer({ item, pathname, nested, openLabel, onToggle }: {
  item: NavItem; pathname: string; nested?: boolean;
  openLabel: string | null; onToggle: (label: string | null) => void;
}) {
  const [localExpanded, setLocalExpanded] = useState(
    item.children?.some((c) => c.href && pathname.startsWith(c.href)) ?? false
  );

  if (item.children) {
    const expanded = nested ? localExpanded : openLabel === item.label;

    return (
      <div>
        <button
          onClick={() => {
            if (nested) {
              setLocalExpanded(!localExpanded);
            } else {
              onToggle(openLabel === item.label ? null : item.label);
            }
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            nested
              ? "text-blue-300 bg-white/5 hover:bg-white/10 hover:text-white font-label-sm text-label-sm"
              : "text-blue-200 hover:bg-white/10 hover:text-white font-label-md text-label-md"
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
              <NavItemRenderer key={child.label} item={child} pathname={pathname} nested openLabel={openLabel} onToggle={onToggle} />
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
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? "bg-white/15 text-white"
          : nested
            ? "text-blue-300 bg-white/5 hover:bg-white/10 hover:text-white font-label-sm text-label-sm"
            : "text-blue-200 hover:bg-white/10 hover:text-white font-label-md text-label-md"
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}
