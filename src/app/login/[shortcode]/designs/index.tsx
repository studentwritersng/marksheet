import type { ReactNode } from "react";
import type { LoginDesign, LoginTexts } from "@/lib/portal-theme";

export interface LoginDesignSchool {
  name: string;
  logo: string | null;
  motto: string | null;
}

export interface AnnouncementLike {
  id: string;
  title: string;
  content: string;
  publishedAt: string | null;
}

interface LayoutProps {
  school: LoginDesignSchool;
  texts: LoginTexts;
  image: string | null;
  announcements: AnnouncementLike[];
  children: ReactNode;
}

function BrandBadge({ school, className = "" }: { school: LoginDesignSchool; className?: string }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-full bg-primary-container ${className}`}>
      {school.logo ? (
        <img src={school.logo} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
          school
        </span>
      )}
    </div>
  );
}

function ImagePanel({ image, school, label }: { image: string | null; school: LoginDesignSchool; label: string }) {
  if (image) {
    return <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  }
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-inverse-primary">
      <div className="flex h-full w-full items-center justify-center p-8">
        <span className="font-headline-md text-headline-md text-on-primary/90">{label}</span>
      </div>
    </div>
  );
}

function Footer({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <footer className="mt-8 text-center font-body-sm text-body-sm text-on-surface-variant">
      {text}
    </footer>
  );
}

function AnnouncementsPanel({ announcements, title }: { announcements: AnnouncementLike[]; title: string }) {
  if (announcements.length === 0) return null;
  return (
    <div className="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 border-b border-surface-variant pb-2 font-label-caps text-label-caps uppercase text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px]">campaign</span>
        {title}
      </h3>
      <div className="space-y-4">
        {announcements.map((a) => (
          <article key={a.id}>
            {a.publishedAt && (
              <p className="mb-1 font-label-caps text-[10px] text-outline-variant">
                {new Date(a.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
              </p>
            )}
            <h4 className="font-body-md text-body-md font-semibold text-on-surface">{a.title}</h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{a.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Minimalist ----------------------------- */
function MinimalistLayout({ school, texts, children }: LayoutProps) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-surface p-margin-mobile md:p-margin-desktop">
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-10">
        <svg className="aspect-square w-full max-w-[1000px]" fill="none" viewBox="0 0 1000 1000">
          <circle cx="500" cy="500" r="400" stroke="currentColor" strokeDasharray="10 20" strokeWidth="2" />
          <circle cx="500" cy="500" r="300" stroke="currentColor" strokeWidth="1" />
          <circle cx="500" cy="500" r="200" stroke="currentColor" strokeDasharray="5 15" strokeWidth="2" />
        </svg>
      </div>
      <div className="relative z-10 w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm md:p-10">
        <div className="mb-8 text-center">
          <BrandBadge school={school} className="mx-auto mb-4 h-12 w-12" />
          <h1 className="mb-2 font-headline-md text-headline-md text-primary">{texts.heading}</h1>
          {texts.subheading && <p className="font-body-sm text-body-sm text-on-surface-variant">{texts.subheading}</p>}
        </div>
        {children}
        <div className="mt-8 text-center">
          <a className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-primary" href="#">
            <span className="material-symbols-outlined text-sm">help</span>
            Need help signing in?
          </a>
        </div>
      </div>
    </main>
  );
}

/* ----------------------------- Illustrative ----------------------------- */
function IllustrativeLayout({ school, texts, image, children }: LayoutProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface p-margin-mobile md:p-margin-desktop">
      <div className="grid w-full max-w-container-max grid-cols-1 items-center gap-gutter md:grid-cols-12">
        <div className="relative hidden h-full min-h-[500px] overflow-hidden rounded-xl border border-outline-variant/30 shadow-sm md:col-span-7 lg:col-span-8">
          <ImagePanel image={image} school={school} label={school.name} />
        </div>
        <div className="md:col-span-5 lg:col-span-4">
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.05)] md:p-8">
            <div className="mb-8 text-center">
              <h1 className="mb-2 font-headline-md text-headline-md text-primary">{texts.heading}</h1>
              {texts.subheading && <p className="font-body-md text-body-md text-on-surface-variant">{texts.subheading}</p>}
            </div>
            {children}
          </div>
          <Footer text={texts.footerText} />
        </div>
      </div>
    </main>
  );
}

/* ----------------------------- Classic ----------------------------- */
function ClassicLayout({ school, texts, children }: LayoutProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface-container-low p-margin-mobile md:p-margin-desktop">
      <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-sm md:p-8">
        <div className="absolute left-0 top-0 h-1 w-full bg-primary" />
        <div className="mb-8 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest">
            {school.logo ? (
              <img src={school.logo} alt="" className="h-full w-full rounded-full object-contain" />
            ) : (
              <span className="material-symbols-outlined text-5xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_balance
              </span>
            )}
          </div>
        </div>
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-headline-md text-headline-md text-primary">{texts.heading}</h1>
          {texts.subheading && <p className="font-body-sm text-body-sm text-on-surface-variant">{texts.subheading}</p>}
        </div>
        {children}
        <Footer text={texts.footerText} />
      </div>
    </main>
  );
}

/* ----------------------------- Split (faculty) ----------------------------- */
function SplitLayout({ school, texts, image, children }: LayoutProps) {
  return (
    <main className="flex min-h-screen flex-col bg-surface md:flex-row">
      <div className="relative hidden h-auto min-h-screen w-1/2 overflow-hidden md:flex md:flex-col md:justify-between">
        <ImagePanel image={image} school={school} label={school.name} />
        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-margin-desktop">
          <span className="font-headline-md text-headline-md font-bold text-on-primary drop-shadow-md">{texts.brandLine ?? school.name}</span>
          <div className="max-w-md text-on-primary drop-shadow-md">
            <h1 className="mb-4 font-headline-lg text-headline-lg">{texts.brandLine ?? "Empowering Scholarship"}</h1>
            {texts.subheading && <p className="font-body-lg text-body-lg opacity-90">{texts.subheading}</p>}
          </div>
        </div>
      </div>
      <div className="flex w-full items-center justify-center bg-surface p-margin-mobile md:w-1/2 md:p-margin-desktop">
        <div className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest p-6 md:p-8">
          <div className="mb-8 text-center md:text-left">
            <h2 className="mb-2 font-headline-md text-headline-md text-primary">{texts.heading}</h2>
            {texts.subheading && <p className="font-body-md text-body-md text-on-surface-variant">{texts.subheading}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

/* ----------------------------- Secure (admin) ----------------------------- */
function SecureLayout({ school, texts, image, announcements, children }: LayoutProps) {
  return (
    <main className="relative flex flex-1 items-center justify-center bg-surface px-margin-mobile py-12 md:px-margin-desktop md:py-24">
      <div className="mx-auto grid w-full max-w-container-max grid-cols-1 items-center gap-gutter md:grid-cols-12">
        <div className="z-20 md:col-span-7 lg:col-span-6 lg:col-start-2">
          <div className="relative overflow-hidden rounded-xl border border-outline-variant p-6 shadow-lg md:p-8 lg:p-12" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <div className="absolute left-0 top-0 h-2 w-full bg-primary" />
            <div className="mb-8">
              <div className="mb-2 flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  shield_person
                </span>
                <h1 className="font-headline-md text-headline-md text-primary">{texts.heading}</h1>
              </div>
              {texts.subheading && <h2 className="font-headline-sm text-headline-sm text-on-surface-variant">{texts.subheading}</h2>}
            </div>
            {children}
          </div>
        </div>
        <div className="z-20 mt-8 flex flex-col gap-6 md:col-span-5 lg:col-span-4 lg:col-start-8 md:mt-0">
          <div className="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 border-b border-surface-variant pb-2 font-label-caps text-label-caps uppercase text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">monitor_heart</span>
              System Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-body-md text-body-md text-on-surface">Student Information System</span>
                <span className="font-body-sm text-body-sm text-secondary">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body-md text-body-md text-on-surface">Result Portal</span>
                <span className="font-body-sm text-body-sm text-secondary">Operational</span>
              </div>
            </div>
          </div>
          <AnnouncementsPanel announcements={announcements} title="Admin Announcements" />
          <div className="hidden h-32 overflow-hidden rounded-xl border border-surface-variant lg:block">
            <ImagePanel image={image} school={school} label={school.name} />
          </div>
        </div>
      </div>
    </main>
  );
}

/* ----------------------------- Modern Dark ----------------------------- */
function DarkLayout({ school, texts, announcements, children }: LayoutProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-[#191c1d] p-margin-mobile md:p-margin-desktop">
      <div className="mx-auto grid w-full max-w-container-max grid-cols-1 items-center gap-gutter md:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border border-[#44474d] bg-[#2e3132] p-6 shadow-2xl md:p-12">
          <div className="absolute left-0 top-0 h-1 w-full bg-secondary" />
          <div className="mb-8 text-center md:text-left">
            <h1 className="mb-2 font-headline-md text-headline-md text-on-surface">{texts.heading}</h1>
            {texts.subheading && <p className="font-body-md text-body-md text-on-surface-variant">{texts.subheading}</p>}
          </div>
          {children}
        </div>
        <div className="hidden flex-col gap-6 p-6 md:flex">
          <div className="rounded-xl border border-[#44474d] bg-[#151718] p-8">
            <div className="mb-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-3xl text-secondary">campaign</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">System Announcements</h2>
            </div>
            <AnnouncementsPanel announcements={announcements} title="System Announcements" />
          </div>
        </div>
      </div>
    </main>
  );
}

const LAYOUTS: Record<LoginDesign, (p: LayoutProps) => ReactNode> = {
  minimalist: MinimalistLayout,
  illustrative: IllustrativeLayout,
  classic: ClassicLayout,
  split: SplitLayout,
  secure: SecureLayout,
  dark: DarkLayout,
};

export function LoginDesignRenderer({
  design,
  school,
  texts,
  image,
  announcements,
  children,
}: {
  design: LoginDesign;
  school: LoginDesignSchool;
  texts: LoginTexts;
  image: string | null;
  announcements: AnnouncementLike[];
  children: ReactNode;
}) {
  const Layout = LAYOUTS[design] ?? ClassicLayout;
  return <Layout school={school} texts={texts} image={image} announcements={announcements} children={children} />;
}
