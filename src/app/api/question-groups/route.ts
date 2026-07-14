import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = await resolvePermissions(user);
  if (!canManageSchool(permissions) || !user.schoolId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const subjectId = req.nextUrl.searchParams.get("subjectId");
  if (!subjectId) return NextResponse.json({ groups: [] });

  const groups = await prisma.questionGroup.findMany({
    where: { subjectId },
    select: { id: true, stimulusId: true },
  });

  return NextResponse.json({ groups });
}
