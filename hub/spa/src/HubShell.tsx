import type { ReactNode } from "react";
import type { Branding } from "./api";

export interface NavItem {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

/** Shared full-page dashboard shell: dark sidebar (branding + profile + nav) and a scrollable content column. */
export function HubShell({
  branding,
  profile,
  nav,
  badge,
  children,
}: {
  branding: Branding;
  profile: { name: string; subline: string; avatarUrl?: string | null };
  nav: NavItem[];
  badge: string;
  children: ReactNode;
}) {
  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-primary text-inverse-on-surface flex flex-col min-h-screen sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.schoolName}
              className="w-10 h-10 rounded-full object-contain bg-white/10 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                school
              </span>
            </div>
          )}
          <p className="text-sm font-semibold leading-tight truncate">{branding.schoolName}</p>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-sm font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{profile.name}</p>
              <p className="text-xs text-on-primary-container/80 truncate">{profile.subline}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                item.active ? "bg-white/15" : "hover:bg-white/5 text-on-primary-container"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-primary-container">{badge}</p>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 p-6 sm:p-8">{children}</main>
    </div>
  );
}
