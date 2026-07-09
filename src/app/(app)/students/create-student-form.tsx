"use client";

import { useActionState, useState } from "react";
import { createStudentAction, type ActionState } from "./actions";
import { ImageUploader } from "@/components/image-uploader";

const init: ActionState = {};

interface ClassOption {
  id: string;
  name: string;
  level: string;
  section: string;
  department: string;
}

const LEVEL_ORDER = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

export function CreateStudentForm({ classes }: { classes: ClassOption[] }) {
  const [state, action, pending] = useActionState(createStudentAction, init);
  const [photoUrl, setPhotoUrl] = useState("");

  // Group classes by level in order
  const grouped = LEVEL_ORDER.reduce<Record<string, ClassOption[]>>((acc, lvl) => {
    const items = classes.filter((c) => c.level === lvl);
    if (items.length > 0) acc[lvl] = items;
    return acc;
  }, {});

  return (
    <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
      <h2 className="mb-3 font-headline-sm text-headline-sm text-on-surface font-semibold">Register Student</h2>
      <p className="mb-3 font-label-sm text-label-sm text-on-surface-variant">Student ID is auto-generated from school shortcode + sequence (e.g. TDC00123). Set the shortcode in Settings → School.</p>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input name="firstName" placeholder="First name" required className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
          <input name="lastName" placeholder="Last name" required className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        </div>
        <input name="email" placeholder="Student email (optional)" type="email" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        <div className="flex gap-2">
          <select name="gender" className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
            <option value="">— Gender —</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <select name="classId" className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
            <option value="">— Class —</option>
            {Object.entries(grouped).map(([level, cls]) => (
              <optgroup key={level} label={level}>
                {cls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.department ? `${c.name}` : c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input name="dateOfBirth" type="date" placeholder="Date of birth" className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
          <input name="ethnicity" placeholder="Ethnicity (optional)" className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
          <input name="religion" placeholder="Religion (optional)" className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        </div>
        <hr className="border-outline-variant" />
        <ImageUploader currentUrl={photoUrl} onUploaded={(url) => setPhotoUrl(url)} label="Passport Photo (optional)" />
        <input type="hidden" name="passportPhoto" value={photoUrl} />
        <hr className="border-outline-variant" />
        <p className="font-label-sm text-label-sm text-on-surface-variant">Guardian (optional)</p>
        <input name="guardianName" placeholder="Full name" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        <input name="guardianPhone" placeholder="Phone" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        <input name="guardianEmail" placeholder="Guardian email (optional)" type="email" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        <button type="submit" disabled={pending} className="w-full bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
          {pending ? "Saving…" : "Register"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      </div>
    </form>
  );
}