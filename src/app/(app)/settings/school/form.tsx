"use client";

import { useActionState, useState, useTransition } from "react";
import { updateSchoolSettingsAction, exportSchoolBackupAction } from "./actions";
import { ImageUploader } from "@/components/image-uploader";
import { PORTAL_THEMES, LOGIN_DESIGNS } from "@/lib/portal-theme";

export function SchoolSettingsForm({
  school,
}: {
  school: {
    name: string;
    address: string;
    logo: string;
    phone: string;
    email: string;
    motto: string;
    signature: string;
    stamp: string;
    shortcode: string;
    maintenanceMode: boolean;
    feeGateExams: boolean;
    feeGateResults: boolean;
    attendancePeriodEnabled: boolean;
    attendanceLateCutoff: string | null;
    portalTheme: string;
    loginDesign: string;
    loginImage: string;
    loginTexts: Record<string, string> | null;
  };
}) {
  const [state, action, pending] = useActionState(updateSchoolSettingsAction, {});
  const [logoUrl, setLogoUrl] = useState(school.logo);
  const [sigUrl, setSigUrl] = useState(school.signature);
  const [stampUrl, setStampUrl] = useState(school.stamp);

  const [portalTheme, setPortalTheme] = useState(school.portalTheme || "blue");
  const [loginDesign, setLoginDesign] = useState(school.loginDesign || "classic");
  const [loginImgUrl, setLoginImgUrl] = useState(school.loginImage);
  const selectedDesign = LOGIN_DESIGNS.find((d) => d.key === loginDesign);

  return (
    <form action={action} data-portal-theme={portalTheme} className="space-y-6">
      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-5">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">General Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">School Name</label>
            <input name="name" defaultValue={school.name} required className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Shortcode</label>
            <input name="shortcode" defaultValue={school.shortcode} maxLength={5} placeholder="e.g. TDC" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary uppercase" />
            <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">Used to generate student IDs (e.g. TDC00123). Enter 2–5 uppercase letters.</p>
          </div>
          <div className="md:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Motto</label>
            <input name="motto" defaultValue={school.motto} placeholder="e.g. Knowledge is Freedom" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
          <div className="md:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Address</label>
            <textarea name="address" defaultValue={school.address} rows={3} className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Phone</label>
            <input name="phone" defaultValue={school.phone} placeholder="+234 800 000 0000" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Email</label>
            <input name="email" type="email" defaultValue={school.email} placeholder="admin@school.edu.ng" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="bg-white border border-outline-variant rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Maintenance Mode</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">When enabled, only Super Admins can access the portal. Other users see a maintenance notice.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="maintenanceMode" defaultChecked={school.maintenanceMode} className="sr-only peer" />
            <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
      </div>

      {/* Fee Gating */}
      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Fee Status Gating</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Configure what happens when a student&apos;s fee status is not cleared. The platform does not process payments — this simply gates access based on a status flag set by a bursar/admin.</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label-md text-label-md text-on-surface font-medium">Block Exam Access</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Students with unpaid fees cannot start exams.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="feeGateExams" defaultChecked={school.feeGateExams} className="sr-only peer" />
            <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label-md text-label-md text-on-surface font-medium">Block Result Release</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Results are computed but marked as withheld until fee status is cleared.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="feeGateResults" defaultChecked={school.feeGateResults} className="sr-only peer" />
            <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
      </div>

      {/* Daily Attendance Settings */}
      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Daily Attendance Settings</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label-md text-label-md text-on-surface font-medium">Per-Period Attendance</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">When enabled, teachers can record attendance per class period instead of once per day.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="attendancePeriodEnabled" defaultChecked={school.attendancePeriodEnabled} className="sr-only peer" />
            <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Late Cut-off Time</label>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-2">Sign-ins after this time are automatically marked as &quot;late&quot;. Leave empty to disable.</p>
          <input type="time" name="attendanceLateCutoff" defaultValue={school.attendanceLateCutoff ?? ""} className="w-full max-w-xs border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {/* Appearance & Login Screen */}
      <div id="appearance" className="bg-white border border-outline-variant rounded-xl p-6 space-y-6">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Appearance &amp; Login Screen</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Customise the portal&apos;s primary colour and choose a login screen layout. Changes apply to this school only.</p>
        </div>

        {/* Theme colour */}
        <div>
          <label className="font-label-md text-label-md text-on-surface font-medium block mb-2">Primary Colour Theme</label>
          <div className="flex flex-wrap gap-3">
            {PORTAL_THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPortalTheme(t.key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  portalTheme === t.key ? "border-primary ring-2 ring-primary text-on-surface" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: t.swatch }} />
                {t.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="portalTheme" value={portalTheme} />
        </div>

        {/* Login design */}
        <div>
          <label className="font-label-md text-label-md text-on-surface font-medium block mb-2">Login Screen Design</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {LOGIN_DESIGNS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setLoginDesign(d.key)}
                className={`overflow-hidden rounded-lg border text-left transition-colors ${
                  loginDesign === d.key ? "border-primary ring-2 ring-primary" : "border-outline-variant hover:bg-surface-container-low"
                }`}
              >
                <div className="aspect-[4/3] bg-surface-container-highest">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.preview} alt={d.label} className="h-full w-full object-cover" />
                </div>
                <div className="px-3 py-2 text-sm font-medium text-on-surface">{d.label}</div>
              </button>
            ))}
          </div>
          <input type="hidden" name="loginDesign" value={loginDesign} />
        </div>

        {/* Login image (only for image-based designs) */}
        {selectedDesign?.hasImage && (
          <div>
            <label className="font-label-md text-label-md text-on-surface font-medium block mb-2">Login Image</label>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-2">Shown on the {selectedDesign.label} login screen. If left empty, a branded gradient is used.</p>
            <ImageUploader currentUrl={loginImgUrl} onUploaded={(url) => setLoginImgUrl(url)} label="Login Image" />
            <input type="hidden" name="loginImage" value={loginImgUrl} />
          </div>
        )}

        {/* Editable login text */}
        <div>
          <label className="font-label-md text-label-md text-on-surface font-medium block mb-2">Login Screen Text</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Heading</label>
              <input name="loginHeading" defaultValue={school.loginTexts?.heading ?? ""} placeholder="e.g. Student Portal" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subheading</label>
              <input name="loginSubheading" defaultValue={school.loginTexts?.subheading ?? ""} placeholder="e.g. Sign in to the Academic Portal" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Brand Line (split / secure)</label>
              <input name="loginBrandLine" defaultValue={school.loginTexts?.brandLine ?? ""} placeholder="e.g. Empowering Scholarship" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Footer Text</label>
              <input name="loginFooterText" defaultValue={school.loginTexts?.footerText ?? ""} placeholder="© Your School" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-5">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Images & Branding</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <ImageUploader currentUrl={logoUrl} onUploaded={(url) => setLogoUrl(url)} label="School Logo" />
            <input type="hidden" name="logo" value={logoUrl} />
          </div>
          <div>
            <ImageUploader currentUrl={sigUrl} onUploaded={(url) => setSigUrl(url)} label="Principal's Signature" />
            <input type="hidden" name="signature" value={sigUrl} />
          </div>
          <div>
            <ImageUploader currentUrl={stampUrl} onUploaded={(url) => setStampUrl(url)} label="School Stamp" />
            <input type="hidden" name="stamp" value={stampUrl} />
          </div>
        </div>
      </div>

      {state.error && <p className="bg-red-50 text-red-700 font-body-sm text-body-sm px-4 py-3 rounded-lg border border-red-200">{state.error}</p>}
      {state.success && <p className="bg-green-50 text-green-700 font-body-sm text-body-sm px-4 py-3 rounded-lg border border-green-200">{state.success}</p>}

      {/* Backup & Restore */}
      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-4">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Backup & Restore</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Download your school data as a JSON file. Config backup includes settings, classes, subjects, staff, and timetable setup. Full backup includes all academic records.</p>
        <div className="flex flex-wrap gap-3">
          <DownloadBackupButton mode="config" label="Download Config Backup" />
          <DownloadBackupButton mode="full" label="Download Full Backup" />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-6 rounded-lg hover:bg-primary-container disabled:opacity-60 transition-colors">
          {pending ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </form>
  );
}

function DownloadBackupButton({ mode, label }: { mode: "config" | "full"; label: string }) {
  const [pending, startTransition] = useTransition();

  const handleDownload = () => {
    startTransition(async () => {
      const result = await exportSchoolBackupAction(mode);
      if (result.error) { alert(result.error); return; }
      const blob = new Blob([result.data!], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename!;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <button type="button" onClick={handleDownload} disabled={pending}
      className="border border-outline-variant text-on-surface font-label-sm text-label-sm py-2 px-4 rounded-lg hover:bg-surface-container-high disabled:opacity-60 transition-colors">
      {pending ? "Downloading…" : label}
    </button>
  );
}
