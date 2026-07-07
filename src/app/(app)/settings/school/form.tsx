"use client";

import { useActionState, useState } from "react";
import { updateSchoolSettingsAction } from "./actions";
import { ImageUploader } from "@/components/image-uploader";

export function SchoolSettingsForm({
  school,
}: {
  school: { name: string; address: string; logo: string; phone: string; email: string; motto: string; signature: string; stamp: string };
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
