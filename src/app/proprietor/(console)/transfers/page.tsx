import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { isGroupAddonActive } from "@/lib/addons/group-check";
import { TransfersClient } from "./transfers-client";

export default async function ProprietorTransfersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "proprietor" || !user.proprietorGroupId) {
    redirect("/proprietor/login");
  }

  const groupId = user.proprietorGroupId;
  const addonActive = await isGroupAddonActive(groupId, "Multi-Branch / Group of Schools");

  if (!addonActive) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
          The Multi-Branch addon is not active for your school group. Activate it on the{" "}
          <a href="/proprietor/billing" className="underline font-semibold">Billing & Addons</a> page.
        </div>
      </div>
    );
  }

  const transfers = await prisma.groupStudentTransferRecord.findMany({
    where: { groupId },
    orderBy: { transferredAt: "desc" },
    include: {
      originSchool: { select: { name: true } },
      destinationSchool: { select: { name: true } },
      originStudent: { select: { firstName: true, lastName: true, admissionNumber: true } },
      destinationStudent: { select: { firstName: true, lastName: true, admissionNumber: true } },
    },
  });

  return (
    <TransfersClient
      transfers={transfers.map((t) => ({
        id: t.id,
        originSchoolName: t.originSchool.name,
        destinationSchoolName: t.destinationSchool.name,
        originStudentName: `${t.originStudent.firstName} ${t.originStudent.lastName}`,
        originAdmissionNumber: t.originStudent.admissionNumber,
        destinationStudentName: `${t.destinationStudent.firstName} ${t.destinationStudent.lastName}`,
        destinationAdmissionNumber: t.destinationStudent.admissionNumber,
        transferredAt: t.transferredAt.toISOString(),
        notes: t.notes,
      }))}
    />
  );
}
