import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { searchRecipientsAction } from "@/app/(app)/messages/actions";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) {
    return NextResponse.json({ recipients: [] });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  const result = await searchRecipientsAction(query);
  return NextResponse.json(result);
}
