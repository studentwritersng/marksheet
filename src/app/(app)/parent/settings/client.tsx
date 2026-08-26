interface Props {
  phone: string | null;
}

export function ParentSettingsClient({ phone }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-5">
      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Contact Info</h2>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Phone: {phone ?? "Not set"}
      </p>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-3">
        You receive notifications for all updates about your ward — no opt-in required.
      </p>
    </div>
  );
}
