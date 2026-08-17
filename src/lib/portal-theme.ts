// Portal appearance configuration: themes (primary colour), login-screen
// designs, and default editable copy for each design.

export const PORTAL_THEMES = [
  { key: "blue", label: "Blue (default)", swatch: "#002046" },
  { key: "green", label: "Deep Green", swatch: "#0b4a37" },
  { key: "purple", label: "Purple", swatch: "#4a1d6e" },
  { key: "black", label: "Black", swatch: "#111111" },
  { key: "gold", label: "Deep Gold", swatch: "#8a5a00" },
] as const;

export type PortalTheme = (typeof PORTAL_THEMES)[number]["key"];

export const LOGIN_DESIGNS = [
  { key: "minimalist", label: "Minimalist", hasImage: false, preview: "/login-designs/minimalist.png" },
  { key: "illustrative", label: "Illustrative", hasImage: true, preview: "/login-designs/illustrative.png" },
  { key: "classic", label: "Classic", hasImage: false, preview: "/login-designs/classic.png" },
  { key: "split", label: "Split Screen", hasImage: true, preview: "/login-designs/split.png" },
  { key: "secure", label: "Secure / Admin", hasImage: true, preview: "/login-designs/secure.png" },
  { key: "dark", label: "Modern Dark", hasImage: false, preview: "/login-designs/dark.png" },
] as const;

export type LoginDesign = (typeof LOGIN_DESIGNS)[number]["key"];

export interface LoginTexts {
  heading?: string;
  subheading?: string;
  brandLine?: string;
  footerText?: string;
}

export const DEFAULT_LOGIN_TEXTS: Record<LoginDesign, LoginTexts> = {
  minimalist: {
    heading: "Student Portal",
    subheading: "Please sign in to access your academic records and tools.",
    footerText: "© Academic Institution. All rights reserved.",
  },
  illustrative: {
    heading: "Welcome Back",
    subheading: "Sign in to the Academic Portal",
    footerText: "© Academic Institution. All rights reserved.",
  },
  classic: {
    heading: "Sign in to your Institutional Account",
    subheading: "Enter your credentials to access the Academic Portal.",
    footerText: "© Academic Institution. All rights reserved.",
  },
  split: {
    heading: "Faculty / Staff Login",
    subheading: "Please sign in with your institutional credentials.",
    brandLine: "Empowering Scholarship",
    footerText: "© Academic Institution. All rights reserved.",
  },
  secure: {
    heading: "Academic Portal",
    subheading: "Administrative Login",
    brandLine: "Academic Portal",
    footerText: "© Academic Institution. All rights reserved.",
  },
  dark: {
    heading: "Academic Portal",
    subheading: "Secure access to your academic resources.",
    footerText: "© Academic Institution. All rights reserved.",
  },
};

export function resolveLoginTexts(design: string, texts: LoginTexts | null | undefined): LoginTexts {
  const base = DEFAULT_LOGIN_TEXTS[(design as LoginDesign)] ?? DEFAULT_LOGIN_TEXTS.classic;
  return { ...base, ...(texts ?? {}) };
}

export function isLoginDesign(value: string | null | undefined): value is LoginDesign {
  return !!value && LOGIN_DESIGNS.some((d) => d.key === value);
}
