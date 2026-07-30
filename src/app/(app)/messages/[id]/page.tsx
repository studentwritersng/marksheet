import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getConversationMessagesAction, sendMessageAction } from "../actions";
import { ConversationView } from "../conversation-view";

export default async function ConversationPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await getConversationMessagesAction(id);
  if ("error" in result) notFound();

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex items-center justify-between">
        <div>
          <a href="/messages" className="font-label-sm text-label-sm text-primary hover:underline">
            ← Back to Messages
          </a>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mt-1">
            Conversation
          </h2>
        </div>
      </div>

      <ConversationView conversationId={id} initialMessages={result.messages} />
    </div>
  );
}
