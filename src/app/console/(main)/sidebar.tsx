"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/console", icon: "dashboard" },
  { label: "Schools", href: "/console/schools", icon: "domain" },
  { label: "Licenses", href: "/console/licenses", icon: "verified" },
  { label: "Curriculum", href: "/console/curriculum", icon: "book" },
  { label: "Upload NERDC", href: "/console/nerdc-upload", icon: "upload_file" },
  { label: "Payments", href: "/console/payments", icon: "payments" },
  { label: "Payment Methods", href: "/console/payment-methods", icon: "account_balance" },
  { label: "AI Config", href: "/console/ai", icon: "settings" },
  { label: "Audit Log", href: "/console/audit", icon: "history" },
];

export function ConsoleSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-white/5 flex flex-col bg-[#0a0e1a]">
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-white/5 shrink-0">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#002046] to-[#1e3a5f] flex items-center justify-center">
          <span className="material-symbols-outlined text-[16px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
        </div>
        <span className="font-label-md text-label-md text-white font-semibold">Console</span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/console" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-[11px] text-white/70 font-semibold">{userEmail.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white/50 truncate">{userEmail}</p>
            <p className="text-[10px] text-white/30">Platform Owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
