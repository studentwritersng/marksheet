"use client";

import { useActionState } from "react";
import { updateSchoolSettingsAction } from "./actions";

export function SchoolSettingsForm({
  school,
}: {
  school: { name: string; address: string; logo: string; phone: string; email: string; motto: string };
}) {
  const [state, action, pending] = useActionState(updateSchoolSettingsAction, {});

  return (
    <form action={action} className="space-y-6">
      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-5">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">General Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">School Name</label>
            <input
              name="name"
              defaultValue={school.name}
              required
              className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md text-on-surface bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Motto</label>
            <input
              name="motto"
              defaultValue={school.motto}
              placeholder="e.g. Knowledge is Freedom"
              className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md text-on-surface bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Address</label>
            <textarea
              name="address"
              defaultValue={school.address}
              rows={3}
              className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md text-on-surface bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Phone</label>
            <input
              name="phone"
              defaultValue={school.phone}
              placeholder="+234 800 000 0000"
              className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md text-on-surface bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={school.email}
              placeholder="admin@school.edu.ng"
              className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md text-on-surface bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Logo URL</label>
            <input
              name="logo"
              defaultValue={school.logo}
              placeholder="https://example.com/logo.png"
              className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md text-on-surface bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            />
            {school.logo && (
              <div className="mt-2 flex items-center gap-3">
                <img src={school.logo} alt="School logo" className="h-12 w-auto rounded border border-outline-variant" />
                <span className="font-label-sm text-label-sm text-on-surface-variant">Current logo preview</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {state.error && (
        <p className="bg-red-50 text-red-700 font-body-sm text-body-sm px-4 py-3 rounded-lg border border-red-200">{state.error}</p>
      )}
      {state.success && (
        <p className="bg-green-50 text-green-700 font-body-sm text-body-sm px-4 py-3 rounded-lg border border-green-200">{state.success}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-[#002046] text-white font-label-md text-label-md py-2.5 px-6 rounded-lg hover:bg-[#003366] disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
