import { ConsoleNotificationsClient } from "./client";

export default function ConsoleNotificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Notification Providers</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage SMS and WhatsApp provider configurations and templates
        </p>
      </div>
      <ConsoleNotificationsClient />
    </div>
  );
}
