import { NextResponse } from "next/server";
import { processNotificationQueueAction } from "@/lib/notifications/provider-actions";

export async function GET() {
  const result = await processNotificationQueueAction(50);
  return NextResponse.json(result);
}

export async function POST() {
  const result = await processNotificationQueueAction(50);
  return NextResponse.json(result);
}
