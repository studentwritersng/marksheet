import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./form";
import { StudentProfileForm } from "./student-form";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Student profile
  if (user.role === "student" && user.schoolId) {
    const student = await prisma.student.findUnique({
      where: { userId: user.userId },
      include: { currentClass: { select: { name: true } } },
    });
    if (!student) return <p className="font-body-sm text-body-sm text-on-surface-variant">Student record not found.</p>;

    return (
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">My Profile</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">View and update your personal details.</p>
        <div className="mt-6 max-w-2xl">
          <StudentProfileForm
            student={{
              firstName: student.firstName,
              middleName: student.middleName ?? "",
              lastName: student.lastName,
              email: student.email,
              admissionNumber: student.admissionNumber,
              passportPhoto: student.passportPhoto ?? "",
              currentClass: student.currentClass,
            }}
          />
        </div>
      </div>
    );
  }

  if (!user.staffId || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not available for your account type.</p>;
  }

  const staff = await prisma.staff.findUnique({
    where: { id: user.staffId, schoolId: user.schoolId },
  });
  if (!staff) return <p className="font-body-sm text-body-sm text-on-surface-variant">Staff record not found.</p>;

  return (
    <div>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">My Profile</h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">Update your personal details, profile photo, and signature. Your signature is used on report cards.</p>
      <div className="mt-6 max-w-2xl">
        <ProfileForm
          staff={{
            fullName: staff.fullName,
            phone: staff.phone ?? "",
            image: staff.image ?? "",
            signature: staff.signature ?? "",
          }}
        />
      </div>
    </div>
  );
}
