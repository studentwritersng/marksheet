import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { getMyConversationsAction } from "./actions";
import { ConversationsList } from "./conversations-list";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversations = await getMyConversationsAction();
  if (Array.isArray(conversations) && conversations.length === 0 && user.role === "student") {
    // Students don't need messaging in this phase
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Messages
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Conversations with staff and parents.
          </p>
        </div>
      </div>

      <ConversationsList conversations={conversations} />
    </div>
  );
}
