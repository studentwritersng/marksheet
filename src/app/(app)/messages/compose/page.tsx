import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMessageRecipientsAction } from "../actions";
import { ComposeMessageForm } from "./compose-form";

export default async function ComposeMessagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await getMessageRecipientsAction();
  if ("error" in result) {
    return <p className="font-body-sm text-body-sm text-red-600">{result.error}</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <a href="/messages" className="font-label-sm text-label-sm text-primary hover:underline">
        ← Back to Messages
      </a>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mt-2">
        New Message
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">
        Start a new conversation.
      </p>

      <ComposeMessageForm recipients={result.recipients} />
    </div>
  );
}
