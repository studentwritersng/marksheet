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

  // --- Default assessment types -------------------------------------------
  const defaultTypes = [
    { name: "Continuous Assessment 1", code: "CA1", sortOrder: 1 },
    { name: "Continuous Assessment 2", code: "CA2", sortOrder: 2 },
    { name: "Continuous Assessment 3", code: "CA3", sortOrder: 3 },
    { name: "Exam", code: "EXM", sortOrder: 4 },
  ];
  for (const t of defaultTypes) {
    await prisma.assessmentType.upsert({
      where: { schoolId_name: { schoolId: school.id, name: t.name } },
      update: { code: t.code, sortOrder: t.sortOrder },
      create: { schoolId: school.id, name: t.name, code: t.code, sortOrder: t.sortOrder },
    });
  }

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

  // --- Classes (6 base levels, no sections) ------------------------------
  const LEVELS = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];
  const classes: Record<string, string> = {};
  for (const level of LEVELS) {
    const created = await prisma.class.create({
      data: {
        schoolId: school.id,
        sessionId: session.id,
        name: level,
        level,
        section: "",
      },
    });
    classes[level] = created.id;
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

  // Math teacher for JSS1; class teacher for JSS1.
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
          classId: classes["JSS1"],
          sessionId: session.id,
          termId: firstTerm?.id,
        },
        {
          schoolId: school.id,
          staffId: teacher.id,
          assignmentType: "class_teacher",
          classId: classes["JSS1"],
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
      className: "JSS1",
    },
    {
      admissionNumber: "UMS/2025/0002",
      firstName: "Fatima",
      lastName: "Sani",
      gender: "Female",
      className: "JSS1",
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

  // --- Period Tracker addon ------------------------------------------------
  await prisma.addon.upsert({
    where: { name: "Period Tracker" },
    update: {},
    create: {
      name: "Period Tracker",
      description: "Track curriculum coverage by teachers and class captains. Two-way verification ensures accountability for every period taught.",
      features: [
        "Teachers mark curriculum topics as taught per class/subject",
        "Class captains verify taught topics for two-way confirmation",
        "Real-time coverage stats on all dashboards",
        "Track percentage of curriculum completed per subject and term",
      ],
      price: null,
      durationDays: null,
      isActive: true,
      sortOrder: 2,
    },
  });
  console.log(`  Addon: "Period Tracker"`);

  // --- Timetable Generator addon -------------------------------------------
  const addon = await prisma.addon.upsert({
    where: { name: "Timetable Generator" },
    update: {},
    create: {
      name: "Timetable Generator",
      description: "AI-powered collision-free timetable generation for your school. Define templates, subject requirements, staff availability, and generate optimal timetables.",
      features: [
        "Customisable timetable templates with days and periods",
        "Define subject period requirements per class level",
        "Staff availability management with daily/weekly limits",
        "Smart CSP solver that avoids collisions",
        "Score-based optimisation across multiple runs",
        "Room and room type management",
        "Custom timetable rules (hard and soft constraints)",
      ],
      price: null,
      durationDays: null,
      isActive: true,
      sortOrder: 1,
    },
  });
  console.log(`  Addon: "${addon.name}" (${addon.id})`);

  // --- Plan Stages -----------------------------------------------------------
  const plansWithStages = await prisma.licensePlan.findMany({ include: { stages: true } });
  for (const pl of plansWithStages) {
    if (pl.stages.length > 0) {
      console.log(`  Plan "${pl.name}" already has ${pl.stages.length} stage(s), skipping.`);
      continue;
    }
    const basePrice = pl.price?.toNumber() ?? null;
    await prisma.planStage.createMany({
      data: [
        { planId: pl.id, name: "Basic (1–100 students)", price: basePrice ? Math.round(basePrice * 0.7) : null, criteria: { minStudents: 1, maxStudents: 100 }, sortOrder: 1 },
        { planId: pl.id, name: "Standard (101–500 students)", price: basePrice ?? null, criteria: { minStudents: 101, maxStudents: 500 }, sortOrder: 2 },
        { planId: pl.id, name: "Premium (501+ students)", price: basePrice ? Math.round(basePrice * 1.5) : null, criteria: { minStudents: 501 }, sortOrder: 3 },
      ],
    });
    console.log(`  Seeded 3 stages for plan "${pl.name}"`);
  }

  // Assign a default stage to each school that doesn't have one
  const schoolsNoStage = await prisma.school.findMany({ where: { stageId: null }, select: { id: true } });
  for (const s of schoolsNoStage) {
    const firstStage = await prisma.planStage.findFirst({ orderBy: { sortOrder: "asc" } });
    if (firstStage) {
      await prisma.school.update({ where: { id: s.id }, data: { stageId: firstStage.id } });
      console.log(`  Assigned stage "${firstStage.name}" to school ${s.id}`);
    }
  }

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("  Super Admin: super@marksheet.dev / superadmin123");
  console.log("  School Admin: admin@ums.edu.ng / admin123");
  console.log("  Teacher:     j.bello@ums.edu.ng / teacher123");

  // --- NERDC Curriculum Seed (system defaults) ---------------------------
  const existingTopics = await prisma.curriculumTopic.count({ where: { schoolId: null, isSystem: true } });
  if (existingTopics === 0) {
    const { nerdcSeedTopics } = await require("./nerdc-seed");
    await prisma.curriculumTopic.createMany({
      data: nerdcSeedTopics.map((t: typeof nerdcSeedTopics[0]) => ({
        classLevel: t.classLevel,
        term: t.term,
        subject: t.subject,
        week: t.week,
        topic: t.topic,
        subTopics: t.subTopics,
        isSystem: true,
        schoolId: null,
      })),
      skipDuplicates: true,
    });
    console.log(`Seeded ${nerdcSeedTopics.length} NERDC curriculum topics.`);
  } else {
    console.log(`Curriculum already seeded (${existingTopics} system topics).`);
  }
}

main()
