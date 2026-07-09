"use client";

import { useActionState, useState } from "react";
import { updateStudentProfileAction } from "./actions";
import { ImageUploader } from "@/components/image-uploader";

interface StudentProfileFormProps {
  student: {
    firstName: string;
    middleName: string;
    lastName: string;
    email: string | null;
    admissionNumber: string;
    passportPhoto: string;
    currentClass: { name: string } | null;
  };
}

export function StudentProfileForm({ student }: StudentProfileFormProps) {
  const [state, action, pending] = useActionState(updateStudentProfileAction, {});
  const [imageUrl, setImageUrl] = useState(student.passportPhoto);

  return (
    <form action={action} className="space-y-6">
      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-5">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Personal Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Admission Number</label>
            <input value={student.admissionNumber} disabled className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-surface-container-lowest text-on-surface-variant cursor-not-allowed" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class</label>
            <input value={student.currentClass?.name ?? "—"} disabled className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-surface-container-lowest text-on-surface-variant cursor-not-allowed" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">First Name</label>
            <input name="firstName" defaultValue={student.firstName} required className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Middle Name</label>
            <input name="middleName" defaultValue={student.middleName} className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Last Name</label>
            <input name="lastName" defaultValue={student.lastName} required className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Phone / Email</label>
            <input name="phone" defaultValue={student.email ?? ""} className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-outline-variant rounded-xl p-6 space-y-5">
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Profile Photo</h3>
        <ImageUploader currentUrl={imageUrl} onUploaded={(url) => setImageUrl(url)} label="Passport Photo" />
        <input type="hidden" name="image" value={imageUrl} />
      </div>

      {state.error && <p className="bg-red-50 text-red-700 font-body-sm text-body-sm px-4 py-3 rounded-lg border border-red-200">{state.error}</p>}
      {state.success && <p className="bg-green-50 text-green-700 font-body-sm text-body-sm px-4 py-3 rounded-lg border border-green-200">{state.success}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="bg-[#002046] text-white font-label-md text-label-md py-2.5 px-6 rounded-lg hover:bg-[#003366] disabled:opacity-60">
          {pending ? "Saving…" : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
