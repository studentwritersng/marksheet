import { NextResponse } from "next/server";
import { authenticateHub } from "@/lib/offline/hub-auth";
import { deriveBundleKey } from "@/lib/offline/crypto";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await authenticateHub(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bundles = await prisma.offlineBundle.findMany({
    where: { hubId: auth.hub.id, status: "pending" },
    orderBy: { issuedAt: "asc" },
  });

  const now = new Date();
  const active = bundles.filter((b) => b.expiresAt > now);

  for (const b of active) {
    await prisma.offlineBundle.update({ where: { id: b.id }, data: { status: "downloaded" } });
  }

  return NextResponse.json({
    bundles: active.map((b) => ({
      bundleId: b.bundleId,
      examId: b.examId,
      status: "downloaded",
      issuedAt: b.issuedAt.toISOString(),
      expiresAt: b.expiresAt.toISOString(),
      payload: b.payload,
      keyHex: deriveBundleKey(auth.hub.signingSecret, b.bundleId),
    })),
  });
}