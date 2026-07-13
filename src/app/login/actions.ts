"use server";

import { prisma } from "@/lib/prisma";

export async function searchSchoolsAction(query: string) {
  const q = query.trim();
  if (!q) return [];

  const schools = await prisma.school.findMany({
    where: {
      OR: [
        { shortcode: { startsWith: q.toUpperCase(), mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, shortcode: true, logo: true, motto: true },
    orderBy: { name: "asc" },
    take: 10,
  });

  return schools.filter((s) => s.shortcode);
}
