"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function MobileSidebar({
  nav,
  schoolInfo,
}: {
  nav: NavItem[];
  schoolInfo: { name: string; logo: string | null; motto: string | null } | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center gap-2 text-primary font-headline-md text-headline-md font-bold"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined text-[24px]">menu</span>
        {schoolInfo?.name ?? "Marksheet"}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-[#002046] z-40 transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-white/20 flex items-center justify-center text-white shrink-0 overflow-hidden">
              {schoolInfo?.logo ? (
                <img src={schoolInfo.logo} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm font-bold text-white truncate">{schoolInfo?.name ?? "Marksheet"}</span>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white p-1">
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((item) => (
            <MobileNavItem key={item.label} item={item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>

        {schoolInfo?.motto && (
          <div className="px-4 py-3 border-t border-white/20 text-blue-300 font-label-sm text-label-sm text-center">
            {schoolInfo.motto}
          </div>
        )}
      </aside>
    </>
  );
}

function MobileNavItem({ item, onNavigate, nested }: { item: NavItem; onNavigate: () => void; nested?: boolean }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(
    item.children?.some((c) => c.href && pathname.startsWith(c.href)) ?? false
  );

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-label-md text-label-md ${
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
          <div className="ml-3 mt-0.5 space-y-0.5">
            {item.children.map((child) => (
              <MobileNavItem key={child.label} item={child} onNavigate={onNavigate} nested />
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
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-label-md text-label-md ${
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
