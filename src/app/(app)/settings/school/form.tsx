"use client";

import { useActionState, useState } from "react";
import { updateSchoolSettingsAction } from "./actions";
import { ImageUploader } from "@/components/image-uploader";

export function SchoolSettingsForm({
  school,
}: {
  school: { name: string; address: string; logo: string; phone: string; email: string; motto: string; signature: string; stamp: string; shortcode: string; maintenanceMode: boolean; feeGateExams: boolean; feeGateResults: boolean };
}) {
  const [state, action, pending] = useActionState(updateSchoolSettingsAction, {});
  const [logoUrl, setLogoUrl] = useState(school.logo);
  const [sigUrl, setSigUrl] = useState(school.signature);
  const [stampUrl, setStampUrl] = useState(school.stamp);

  return (
    <form action={action} className="space-y-6">
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
            <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:bg-[#002046] peer-focus:ring-2 peer-focus:ring-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
      </div>

      {/* Fee Gating (PRD 12) */}
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
            <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:bg-[#002046] peer-focus:ring-2 peer-focus:ring-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label-md text-label-md text-on-surface font-medium">Block Result Release</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Results are computed but marked as withheld until fee status is cleared.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" name="feeGateResults" defaultChecked={school.feeGateResults} className="sr-only peer" />
            <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:bg-[#002046] peer-focus:ring-2 peer-focus:ring-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
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

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="bg-[#002046] text-white font-label-md text-label-md py-2.5 px-6 rounded-lg hover:bg-[#003366] disabled:opacity-60 transition-colors">
          {pending ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
