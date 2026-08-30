"use client";

import { useActionState } from "react";
import { updateProfileAction } from "./actions";

interface ProfileFormProps {
  staff: {
    fullName: string;
    phone: string;
  };
}

export function ProfileForm({ staff }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateProfileAction, {});

  return (
    <form action={action} className="space-y-6">
      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-5">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Personal Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Full Name</label>
            <input name="fullName" defaultValue={staff.fullName} required className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Phone</label>
            <input name="phone" defaultValue={staff.phone} placeholder="+234 800 000 0000" className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
        </div>
      </div>

      {state.error && <p className="bg-red-50 text-red-700 font-body-sm text-body-sm px-4 py-3 rounded-lg border border-red-200">{state.error}</p>}
      {state.success && <p className="bg-green-50 text-green-700 font-body-sm text-body-sm px-4 py-3 rounded-lg border border-green-200">{state.success}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="bg-primary text-white font-label-md text-label-md py-2.5 px-6 rounded-lg hover:bg-primary-container disabled:opacity-60">
          {pending ? "Saving…" : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
