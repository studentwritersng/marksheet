import { PrismaClient, SessionStatus, TermName } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Marksheet demo data...");

  // --- Platform-level Super Admin ---------------------------------------
  const superAdminPassword = await bcrypt.hash("superadmin123", 10);
  await prisma.user.upsert({
    where: { email: "super@marksheet.dev" },
    update: {},
    create: {
      email: "super@marksheet.dev",
      passwordHash: superAdminPassword,
      role: "super_admin",
    },
  });

  // --- Demo school ------------------------------------------------------
  const school = await prisma.school.upsert({
    where: { id: "demo-school" },
    update: {},
    create: {
      id: "demo-school",
      name: "Unity Model Secondary School",
      address: "12 Awolowo Road, Ikeja, Lagos",
      admissionFormat: "UMS/{year}/{seq:4}",
      gradingScale: [
        { grade: "A1", min: 75, max: 100, remark: "Excellent" },
        { grade: "B2", min: 70, max: 74, remark: "Very Good" },
        { grade: "B3", min: 65, max: 69, remark: "Good" },
        { grade: "C4", min: 60, max: 64, remark: "Credit" },
        { grade: "C5", min: 55, max: 59, remark: "Credit" },
        { grade: "C6", min: 50, max: 54, remark: "Credit" },
        { grade: "D7", min: 45, max: 49, remark: "Pass" },
        { grade: "E8", min: 40, max: 44, remark: "Pass" },
        { grade: "F9", min: 0, max: 39, remark: "Fail" },
      ],
    },
  });

  // --- School Admin user + staff ---------------------------------------
  const adminStaff = await prisma.staff.upsert({
    where: { schoolId_email: { schoolId: school.id, email: "admin@ums.edu.ng" } },
    update: {},
    create: {
      schoolId: school.id,
      fullName: "Adaeze Okonkwo",
      email: "admin@ums.edu.ng",
      phone: "08030000001",
    },
  });

  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@ums.edu.ng" },
    update: {},
    create: {
      email: "admin@ums.edu.ng",
      passwordHash: adminPassword,
      role: "staff",
      schoolId: school.id,
      staffId: adminStaff.id,
    },
  });

  // --- Session + 3 terms (PRD 01) --------------------------------------
  const session = await prisma.session.upsert({
    where: { schoolId_label: { schoolId: school.id, label: "2025/2026" } },
    update: {},
    create: {
      schoolId: school.id,
      label: "2025/2026",
      isCurrent: true,
      status: SessionStatus.active,
    },
  });

  const termDefs: { name: TermName; start: string; end: string }[] = [
    { name: TermName.First, start: "2025-09-15", end: "2025-12-19" },
    { name: TermName.Second, start: "2026-01-12", end: "2026-04-10" },
    { name: TermName.Third, start: "2026-04-27", end: "2026-07-24" },
  ];
  for (const [i, t] of termDefs.entries()) {
    await prisma.term.upsert({
      where: { sessionId_name: { sessionId: session.id, name: t.name } },
      update: {},
      create: {
        sessionId: session.id,
        name: t.name,
        startDate: new Date(t.start),
        endDate: new Date(t.end),
        isCurrent: i === 0,
      },
    });
  }

  // --- School admin assignment -----------------------------------------
  const adminAssignmentExists = await prisma.assignment.count({
    where: { staffId: adminStaff.id, assignmentType: "school_admin" },
  });
  if (adminAssignmentExists === 0) {
    await prisma.assignment.create({
      data: {
        schoolId: school.id,
        staffId: adminStaff.id,
        assignmentType: "school_admin",
        sessionId: session.id,
        isTemporary: false,
      },
    });
  }

  // --- Classes ----------------------------------------------------------
  const classNames = [
    { name: "JSS1A", level: "JSS1" },
    { name: "JSS1B", level: "JSS1" },
    { name: "JSS2A", level: "JSS2" },
    { name: "SS1 Science", level: "SS1" },
  ];
  const classes: Record<string, string> = {};
  for (const c of classNames) {
    const created = await prisma.class.upsert({
      where: { sessionId_name: { sessionId: session.id, name: c.name } },
      update: {},
      create: {
        schoolId: school.id,
        sessionId: session.id,
        name: c.name,
        level: c.level,
      },
    });
    classes[c.name] = created.id;
  }

  // --- Subjects ---------------------------------------------------------
  const subjectNames = ["Mathematics", "English Language", "Basic Science", "Biology"];
  const subjects: Record<string, string> = {};
  for (const name of subjectNames) {
    const s = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId: school.id, name } },
      update: {},
      create: { schoolId: school.id, name },
    });
    subjects[name] = s.id;
  }

  // --- A subject teacher with scoped assignments -----------------------
  const teacher = await prisma.staff.upsert({
    where: { schoolId_email: { schoolId: school.id, email: "j.bello@ums.edu.ng" } },
    update: {},
    create: {
      schoolId: school.id,
      fullName: "James Bello",
      email: "j.bello@ums.edu.ng",
      phone: "08030000002",
    },
  });
  const teacherPassword = await bcrypt.hash("teacher123", 10);
  await prisma.user.upsert({
    where: { email: "j.bello@ums.edu.ng" },
    update: {},
    create: {
      email: "j.bello@ums.edu.ng",
      passwordHash: teacherPassword,
      role: "staff",
      schoolId: school.id,
      staffId: teacher.id,
    },
  });

  const firstTerm = await prisma.term.findFirst({
    where: { sessionId: session.id, name: TermName.First },
  });

  // Math teacher for JSS1A and JSS1B; class teacher for JSS1A.
  const existingAssignments = await prisma.assignment.count({
    where: { staffId: teacher.id, sessionId: session.id },
  });
  if (existingAssignments === 0) {
    await prisma.assignment.createMany({
      data: [
        {
          schoolId: school.id,
          staffId: teacher.id,
          assignmentType: "subject_teacher",
          subjectId: subjects["Mathematics"],
          classId: classes["JSS1A"],
          sessionId: session.id,
          termId: firstTerm?.id,
        },
        {
          schoolId: school.id,
          staffId: teacher.id,
          assignmentType: "subject_teacher",
          subjectId: subjects["Mathematics"],
          classId: classes["JSS1B"],
          sessionId: session.id,
          termId: firstTerm?.id,
        },
        {
          schoolId: school.id,
          staffId: teacher.id,
          assignmentType: "class_teacher",
          classId: classes["JSS1A"],
          sessionId: session.id,
          termId: firstTerm?.id,
        },
      ],
    });
  }

  // --- A couple of students --------------------------------------------
  const students = [
    {
      admissionNumber: "UMS/2025/0001",
      firstName: "Chidi",
      lastName: "Nwosu",
      gender: "Male",
      className: "JSS1A",
    },
    {
      admissionNumber: "UMS/2025/0002",
      firstName: "Fatima",
      lastName: "Sani",
      gender: "Female",
      className: "JSS1A",
    },
  ];
  for (const st of students) {
    await prisma.student.upsert({
      where: {
        schoolId_admissionNumber: {
          schoolId: school.id,
          admissionNumber: st.admissionNumber,
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        admissionNumber: st.admissionNumber,
        firstName: st.firstName,
        lastName: st.lastName,
        gender: st.gender,
        currentClassId: classes[st.className],
        admissionDate: new Date("2025-09-15"),
        guardians: {
          create: [
            {
              relationship: "father",
              fullName: `Mr. ${st.lastName}`,
              phone: "08030001111",
              isPrimaryContact: true,
            },
          ],
        },
      },
    });
  }

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("  Super Admin: super@marksheet.dev / superadmin123");
  console.log("  School Admin: admin@ums.edu.ng / admin123");
  console.log("  Teacher:     j.bello@ums.edu.ng / teacher123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
