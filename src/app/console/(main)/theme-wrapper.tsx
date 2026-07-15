"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}

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
  { label: "Addons", href: "/console/addons", icon: "extension" },
  { label: "AI Config", href: "/console/ai", icon: "settings" },
  { label: "Tickets", href: "/console/tickets", icon: "support" },
  { label: "Audit Log", href: "/console/audit", icon: "history" },
];

export function ConsoleThemeWrapper({
  children,
  userEmail,
  logoutAction,
}: {
  children: React.ReactNode;
  userEmail: string;
  logoutAction: () => void;
}) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    const saved = localStorage.getItem("console-theme") as Theme;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("console-theme", next);
  };

  if (!mounted) {
    // Prevent flash of unstyled content during hydration
    return (
      <div className="flex h-screen bg-[#0a0e1a] text-white/50 items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-white border-white/20 animate-spin" />
          <span className="text-xs tracking-widest uppercase opacity-40">Loading Console...</span>
        </div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        className={`flex h-screen overflow-hidden font-sans transition-all duration-300 ${
          theme === "dark" ? "bg-[#070a13] text-slate-100" : "bg-[#f8fafc] text-slate-900"
        }`}
      >
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 border-r flex flex-col transition-all duration-300 ${
            theme === "dark"
              ? "bg-[#0b0f19] border-white/5 text-slate-300"
              : "bg-slate-900 border-slate-800 text-slate-200"
          }`}
        >
          {/* Brand logo */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-white/5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-[18px] text-white font-bold animate-pulse">
                admin_panel_settings
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white tracking-wide uppercase">
                Marksheet
              </span>
              <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest">
                Platform Console
              </span>
            </div>
          </div>

          {/* Nav list */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active =
                pathname === item.href || (item.href !== "/console" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-md shadow-indigo-600/10 scale-[1.02]"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] transition-colors duration-200 ${
                      active ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User profile section */}
          <div className="p-4 border-t border-white/5 shrink-0 bg-black/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                <span className="text-xs text-white font-bold">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/80 font-medium truncate">{userEmail}</p>
                <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">
                  Platform Owner
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header
            className={`h-16 shrink-0 border-b flex items-center justify-between px-4 lg:px-8 transition-colors duration-300 ${
              theme === "dark" ? "bg-[#0b0f19] border-white/5" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-[22px]">menu</span>
              </button>
              <span
                className={`font-semibold tracking-wide text-xs uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Control Center &middot;{" "}
                <span className="text-indigo-500 font-bold">{pathname.split("/").pop() || "Dashboard"}</span>
              </span>
            </div>

            <div className="flex items-center gap-3 lg:gap-6">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={`p-2 rounded-xl transition-all duration-300 flex items-center justify-center relative overflow-hidden group border ${
                  theme === "dark"
                    ? "bg-white/5 border-white/10 text-amber-400 hover:bg-white/10"
                    : "bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:rotate-45">
                  {theme === "dark" ? "light_mode" : "dark_mode"}
                </span>
              </button>

              <div className={`h-5 w-px ${theme === "dark" ? "bg-white/10" : "bg-slate-200"}`} />

              <form action={logoutAction}>
                <button
                  type="submit"
                  className={`text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg border ${
                    theme === "dark"
                      ? "text-slate-400 border-white/5 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
                      : "text-slate-600 border-slate-200 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">logout</span>
                  Sign out
                </button>
              </form>
            </div>
          </header>

          {/* Main canvas */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
