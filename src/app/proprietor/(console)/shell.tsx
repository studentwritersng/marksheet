"use client";

import { createContext, useContext, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/proprietor", icon: "dashboard" },
  { label: "Transfers", href: "/proprietor/transfers", icon: "swap_horiz" },
  { label: "Billing & Addons", href: "/proprietor/billing", icon: "payments" },
  { label: "Settings", href: "/proprietor/settings", icon: "settings" },
];

export function ProprietorConsoleShell({
  children,
  userEmail,
  groupName,
  permissionLevel,
  logoutAction,
}: {
  children: React.ReactNode;
  userEmail: string;
  groupName: string;
  permissionLevel: string;
  logoutAction: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen bg-[#070a13] text-white/50 items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-white border-white/20 animate-spin" />
          <span className="text-xs tracking-widest uppercase opacity-40">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-[#070a13] text-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 border-r flex flex-col transition-all duration-300 bg-[#0b0f19] border-white/5 text-slate-300`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-[18px] text-white">workspaces</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white truncate">{groupName}</span>
            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest">Proprietor Console</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/proprietor" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-md scale-[1.02]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] transition-colors ${active ? "text-white" : "text-slate-500"}`}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-white/5 shrink-0 bg-black/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <span className="text-xs text-white font-bold">{userEmail.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/80 font-medium truncate">{userEmail}</p>
              <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">
                {permissionLevel === "full" ? "Full Access" : "View Only"}
              </p>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white/5 text-slate-400 rounded-lg text-xs font-semibold uppercase tracking-wider hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="h-16 shrink-0 border-b border-white/5 bg-[#0b0f19] flex items-center justify-between px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400">
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <span className="text-sm font-semibold text-white">{groupName}</span>
          <div className="w-8" />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
