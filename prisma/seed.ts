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
    update: { shortcode: "UMS" },
    create: {
      id: "demo-school",
      name: "Unity Model Secondary School",
      shortcode: "UMS",
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
    const created = await prisma.class.upsert({
      where: { sessionId_level_section_department: { sessionId: session.id, level, section: "", department: "" } },
      update: {},
      create: {
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

  // --- Seed stage-specific prices for plans -----------------------------------
  const allPlans = await prisma.licensePlan.findMany();
  for (const pl of allPlans) {
    const basePrice = pl.price?.toNumber() ?? 50000;
    await prisma.licensePlan.update({
      where: { id: pl.id },
      data: {
        basicPrice: Math.round(basePrice * 0.7),
        standardPrice: basePrice,
        premiumPrice: Math.round(basePrice * 1.5),
      },
    });
    console.log(`  Set stage prices for plan "${pl.name}"`);
  }

  // Assign default stage to the demo school
  await prisma.school.update({
    where: { id: school.id },
    data: { stage: "basic" },
  });
  console.log(`  Assigned "basic" stage to school ${school.id}`);

  // --- Seed two new addons: Daily Attendance + Notifications ------------
  const newAddonNames = ["Daily Attendance", "Notifications (WhatsApp & SMS)"];
  for (const name of newAddonNames) {
    const existing = await prisma.addon.findUnique({ where: { name } });
    if (!existing) {
      await prisma.addon.create({
        data: {
          name,
          description: name === "Daily Attendance"
            ? "QR-based student & staff attendance with ID card generation"
            : "WhatsApp and SMS notification service for guardians",
          features: name === "Daily Attendance"
            ? ["QR code ID cards", "Mobile scanning", "Per-period toggle", "Report card integration"]
            : ["WhatsApp messaging", "SMS fallback", "Multiple template rotation", "Anti-ban delays"],
          isActive: true,
          sortOrder: name === "Daily Attendance" ? 3 : 4,
        },
      });
      console.log(`  Seeded addon: "${name}"`);
    }
  }

  // ======================================================================
  // TIMETABLE GENERATOR DEMO DATA
  // ======================================================================

  // --- Additional subjects for SSS --------------------------------
  const extraSubjects = [
    "Physics", "Chemistry", "Further Mathematics", "Literature in English",
    "Government", "Civic Education", "Economics", "Commerce", "Accounting",
    "Computer Science", "Health Education", "CRS",
  ];
  for (const name of extraSubjects) {
    const s = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId: school.id, name } },
      update: {},
      create: { schoolId: school.id, name },
    });
    subjects[name] = s.id;
  }

  // --- Staff (teachers) ------------------------------------------
  const teacherDefs = [
    { email: "f.okeke@ums.edu.ng", name: "Frances Okeke" },
    { email: "t.ade@ums.edu.ng", name: "Tunde Adebayo" },
    { email: "n.chiamaka@ums.edu.ng", name: "Nwosu Chiamaka" },
    { email: "i.samuel@ums.edu.ng", name: "Ibrahim Samuel" },
    { email: "a.oluchi@ums.edu.ng", name: "Amara Oluchi" },
    { email: "d.aminu@ums.edu.ng", name: "Danjuma Aminu" },
    { email: "g.ekpo@ums.edu.ng", name: "Grace Ekpo" },
    { email: "k.obinna@ums.edu.ng", name: "Kehinde Obinna" },
  ];
  const staffById: Record<string, string> = {};
  for (const t of teacherDefs) {
    const s = await prisma.staff.upsert({
      where: { schoolId_email: { schoolId: school.id, email: t.email } },
      update: {},
      create: { schoolId: school.id, fullName: t.name, email: t.email, phone: "0803000000X" },
    });
    staffById[t.email] = s.id;
    await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { email: t.email, passwordHash: teacherPassword, role: "staff", schoolId: school.id, staffId: s.id },
    });
  }

  // --- Subject-Teacher assignments ---------------------------------
  const subjAssignments: { teacherEmail: string; subjectName: string; classLevel: string }[] = [
    { teacherEmail: "j.bello@ums.edu.ng", subjectName: "Mathematics", classLevel: "SSS1" },
    { teacherEmail: "j.bello@ums.edu.ng", subjectName: "Mathematics", classLevel: "SSS2" },
    { teacherEmail: "f.okeke@ums.edu.ng", subjectName: "Mathematics", classLevel: "SSS3" },
    { teacherEmail: "f.okeke@ums.edu.ng", subjectName: "Further Mathematics", classLevel: "SSS1" },
    { teacherEmail: "f.okeke@ums.edu.ng", subjectName: "Further Mathematics", classLevel: "SSS2" },
    { teacherEmail: "t.ade@ums.edu.ng", subjectName: "English Language", classLevel: "SSS1" },
    { teacherEmail: "t.ade@ums.edu.ng", subjectName: "English Language", classLevel: "SSS2" },
    { teacherEmail: "t.ade@ums.edu.ng", subjectName: "Literature in English", classLevel: "SSS1" },
    { teacherEmail: "t.ade@ums.edu.ng", subjectName: "Literature in English", classLevel: "SSS2" },
    { teacherEmail: "n.chiamaka@ums.edu.ng", subjectName: "Biology", classLevel: "SSS1" },
    { teacherEmail: "n.chiamaka@ums.edu.ng", subjectName: "Biology", classLevel: "SSS2" },
    { teacherEmail: "n.chiamaka@ums.edu.ng", subjectName: "Biology", classLevel: "SSS3" },
    { teacherEmail: "n.chiamaka@ums.edu.ng", subjectName: "Health Education", classLevel: "SSS1" },
    { teacherEmail: "i.samuel@ums.edu.ng", subjectName: "Physics", classLevel: "SSS1" },
    { teacherEmail: "i.samuel@ums.edu.ng", subjectName: "Physics", classLevel: "SSS2" },
    { teacherEmail: "i.samuel@ums.edu.ng", subjectName: "Physics", classLevel: "SSS3" },
    { teacherEmail: "i.samuel@ums.edu.ng", subjectName: "Chemistry", classLevel: "SSS1" },
    { teacherEmail: "a.oluchi@ums.edu.ng", subjectName: "Chemistry", classLevel: "SSS2" },
    { teacherEmail: "a.oluchi@ums.edu.ng", subjectName: "Chemistry", classLevel: "SSS3" },
    { teacherEmail: "a.oluchi@ums.edu.ng", subjectName: "Computer Science", classLevel: "SSS1" },
    { teacherEmail: "a.oluchi@ums.edu.ng", subjectName: "Computer Science", classLevel: "SSS2" },
    { teacherEmail: "d.aminu@ums.edu.ng", subjectName: "Economics", classLevel: "SSS1" },
    { teacherEmail: "d.aminu@ums.edu.ng", subjectName: "Economics", classLevel: "SSS2" },
    { teacherEmail: "d.aminu@ums.edu.ng", subjectName: "Government", classLevel: "SSS1" },
    { teacherEmail: "d.aminu@ums.edu.ng", subjectName: "Government", classLevel: "SSS2" },
    { teacherEmail: "g.ekpo@ums.edu.ng", subjectName: "Accounting", classLevel: "SSS1" },
    { teacherEmail: "g.ekpo@ums.edu.ng", subjectName: "Accounting", classLevel: "SSS2" },
    { teacherEmail: "g.ekpo@ums.edu.ng", subjectName: "Commerce", classLevel: "SSS1" },
    { teacherEmail: "g.ekpo@ums.edu.ng", subjectName: "Commerce", classLevel: "SSS2" },
    { teacherEmail: "k.obinna@ums.edu.ng", subjectName: "Civic Education", classLevel: "SSS1" },
    { teacherEmail: "k.obinna@ums.edu.ng", subjectName: "Civic Education", classLevel: "SSS2" },
    { teacherEmail: "k.obinna@ums.edu.ng", subjectName: "CRS", classLevel: "SSS1" },
    { teacherEmail: "k.obinna@ums.edu.ng", subjectName: "CRS", classLevel: "SSS2" },
    { teacherEmail: "t.ade@ums.edu.ng", subjectName: "English Language", classLevel: "SSS3" },
    { teacherEmail: "t.ade@ums.edu.ng", subjectName: "Literature in English", classLevel: "SSS3" },
    { teacherEmail: "d.aminu@ums.edu.ng", subjectName: "Economics", classLevel: "SSS3" },
    { teacherEmail: "g.ekpo@ums.edu.ng", subjectName: "Accounting", classLevel: "SSS3" },
    { teacherEmail: "k.obinna@ums.edu.ng", subjectName: "Civic Education", classLevel: "SSS3" },
    { teacherEmail: "k.obinna@ums.edu.ng", subjectName: "CRS", classLevel: "SSS3" },
    { teacherEmail: "d.aminu@ums.edu.ng", subjectName: "Government", classLevel: "SSS3" },
    { teacherEmail: "a.oluchi@ums.edu.ng", subjectName: "Computer Science", classLevel: "SSS3" },
    { teacherEmail: "g.ekpo@ums.edu.ng", subjectName: "Commerce", classLevel: "SSS3" },
  ];

  const existingSubjectAssignments = await prisma.assignment.count({
    where: { schoolId: school.id, sessionId: session.id, assignmentType: "subject_teacher" },
  });
  if (existingSubjectAssignments <= 2) {
    for (const a of subjAssignments) {
      const staffId = staffById[a.teacherEmail];
      const subjectId = subjects[a.subjectName];
      const classId = classes[a.classLevel];
      if (!staffId || !subjectId || !classId) continue;
      const existing = await prisma.assignment.findFirst({
        where: { staffId, subjectId, classId, sessionId: session.id, assignmentType: "subject_teacher" },
      });
      if (!existing) {
        await prisma.assignment.create({
          data: {
            schoolId: school.id, staffId, subjectId, classId,
            sessionId: session.id, termId: firstTerm?.id,
            assignmentType: "subject_teacher",
            isTemporary: false,
          },
        });
      }
    }
  }

  // --- ClassSubject links (SSS1-SSS3) ----------------------------
  const sssSubjects = [
    "Mathematics", "English Language", "Biology", "Civic Education",
    "Computer Science", "Health Education", "CRS",
    "Physics", "Chemistry", "Further Mathematics",
    "Literature in English", "Government",
    "Economics", "Commerce", "Accounting",
  ];
  for (const level of ["SSS1", "SSS2", "SSS3"]) {
    const classId = classes[level];
    if (!classId) continue;
    for (const subjName of sssSubjects) {
      const subjectId = subjects[subjName];
      if (!subjectId) continue;
      await prisma.classSubject.upsert({
        where: { classId_subjectId: { classId, subjectId } },
        update: {},
        create: { schoolId: school.id, classId, subjectId, department: "general" },
      });
    }
  }

  // --- Timetable Template ----------------------------------------
  const template = await prisma.timetableTemplate.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "Default Timetable" } },
    update: {},
    create: {
      schoolId: school.id, name: "Default Timetable",
      appliesTo: ["SSS1", "SSS2", "SSS3"],
    },
  });
  console.log(`  Template: "${template.name}" (${template.id})`);

  // --- School Days -------------------------------------------------
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  for (let i = 0; i < dayNames.length; i++) {
    const existing = await prisma.schoolDay.findFirst({ where: { templateId: template.id, dayIndex: i } });
    if (!existing) {
      await prisma.schoolDay.create({ data: { templateId: template.id, dayName: dayNames[i], dayIndex: i, isTeachingDay: true } });
    }
  }

  // --- Periods ----------------------------------------------------
  const periodDefs = [
    { num: 1, start: "08:00", end: "08:40" },
    { num: 2, start: "08:40", end: "09:20" },
    { num: 3, start: "09:20", end: "10:00" },
    { num: 4, start: "10:00", end: "10:40" },
    { num: 5, start: "11:00", end: "11:40" },   // after break
    { num: 6, start: "11:40", end: "12:20" },
    { num: 7, start: "12:20", end: "13:00" },
    { num: 8, start: "13:00", end: "13:40" },
  ];
  for (const p of periodDefs) {
    const existing = await prisma.addonPeriod.findFirst({ where: { templateId: template.id, periodNumber: p.num } });
    if (!existing) {
      await prisma.addonPeriod.create({ data: { templateId: template.id, periodNumber: p.num, startTime: p.start, endTime: p.end, periodType: "teaching" } });
    }
  }

  // --- Subject Timetable Requirements ----------------------------
  const reqDefs: { classLevel: string; subjectName: string; periods: number; double: boolean; practical: boolean; timePref: string }[] = [
    { classLevel: "SSS1", subjectName: "Mathematics", periods: 5, double: true, practical: false, timePref: "morning" },
    { classLevel: "SSS1", subjectName: "English Language", periods: 5, double: false, practical: false, timePref: "morning" },
    { classLevel: "SSS1", subjectName: "Biology", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS1", subjectName: "Civic Education", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS1", subjectName: "Computer Science", periods: 2, double: true, practical: true, timePref: "afternoon" },
    { classLevel: "SSS1", subjectName: "Health Education", periods: 1, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS1", subjectName: "CRS", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS1", subjectName: "Physics", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS1", subjectName: "Chemistry", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS1", subjectName: "Further Mathematics", periods: 3, double: false, practical: false, timePref: "morning" },
    { classLevel: "SSS1", subjectName: "Literature in English", periods: 3, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS1", subjectName: "Government", periods: 2, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS1", subjectName: "Economics", periods: 3, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS1", subjectName: "Commerce", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS1", subjectName: "Accounting", periods: 3, double: false, practical: false, timePref: "morning" },
    { classLevel: "SSS2", subjectName: "Mathematics", periods: 5, double: true, practical: false, timePref: "morning" },
    { classLevel: "SSS2", subjectName: "English Language", periods: 5, double: false, practical: false, timePref: "morning" },
    { classLevel: "SSS2", subjectName: "Biology", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS2", subjectName: "Civic Education", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS2", subjectName: "Computer Science", periods: 2, double: true, practical: true, timePref: "afternoon" },
    { classLevel: "SSS2", subjectName: "CRS", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS2", subjectName: "Physics", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS2", subjectName: "Chemistry", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS2", subjectName: "Further Mathematics", periods: 3, double: false, practical: false, timePref: "morning" },
    { classLevel: "SSS2", subjectName: "Literature in English", periods: 3, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS2", subjectName: "Government", periods: 2, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS2", subjectName: "Economics", periods: 3, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS2", subjectName: "Commerce", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS2", subjectName: "Accounting", periods: 3, double: false, practical: false, timePref: "morning" },
    { classLevel: "SSS3", subjectName: "Mathematics", periods: 5, double: true, practical: false, timePref: "morning" },
    { classLevel: "SSS3", subjectName: "English Language", periods: 5, double: false, practical: false, timePref: "morning" },
    { classLevel: "SSS3", subjectName: "Biology", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS3", subjectName: "Civic Education", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS3", subjectName: "Computer Science", periods: 2, double: true, practical: true, timePref: "afternoon" },
    { classLevel: "SSS3", subjectName: "CRS", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS3", subjectName: "Physics", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS3", subjectName: "Chemistry", periods: 4, double: true, practical: true, timePref: "morning" },
    { classLevel: "SSS3", subjectName: "Literature in English", periods: 3, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS3", subjectName: "Government", periods: 2, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS3", subjectName: "Economics", periods: 3, double: false, practical: false, timePref: "afternoon" },
    { classLevel: "SSS3", subjectName: "Commerce", periods: 2, double: false, practical: false, timePref: "none" },
    { classLevel: "SSS3", subjectName: "Accounting", periods: 3, double: false, practical: false, timePref: "morning" },
  ];

  let reqCount = 0;
  for (const r of reqDefs) {
    const classId = classes[r.classLevel];
    const subjectId = subjects[r.subjectName];
    if (!classId || !subjectId) continue;
    const existingReq = await prisma.subjectTimetableRequirement.findFirst({
      where: { schoolId: school.id, subjectId, classId },
    });
    if (!existingReq) {
      await prisma.subjectTimetableRequirement.create({
        data: {
          schoolId: school.id, subjectId, classId, classLevel: r.classLevel,
          weeklyPeriodsRequired: r.periods, doublePeriodAllowed: r.double,
          preferredTimeOfDay: r.timePref, isPractical: r.practical,
        },
      });
      reqCount++;
    }
  }
  console.log(`  Created ${reqCount} subject timetable requirements.`);

  // --- Staff Availability ------------------------------------------
  let availCount = 0;
  for (const [, staffId] of Object.entries(staffById)) {
    for (let day = 0; day < 5; day++) {
      const existing = await prisma.staffAvailability.findUnique({
        where: { staffId_day: { staffId, day } },
      });
      if (!existing) {
        await prisma.staffAvailability.create({
          data: { schoolId: school.id, staffId, day, maxPeriodsPerDay: 8, maxPeriodsPerWeek: 40 },
        });
        availCount++;
      }
    }
  }
  // Also add availability for James Bello (existing teacher)
  for (let day = 0; day < 5; day++) {
    const existing = await prisma.staffAvailability.findUnique({
      where: { staffId_day: { staffId: teacher.id, day } },
    });
    if (!existing) {
      await prisma.staffAvailability.create({
        data: { schoolId: school.id, staffId: teacher.id, day, maxPeriodsPerDay: 8, maxPeriodsPerWeek: 40 },
      });
      availCount++;
    }
  }
  console.log(`  Created ${availCount} staff availability records.`);

  // --- Timetable Rules ---------------------------------------------
  const ruleDefs: { ruleType: string; parameters: any; isHard: boolean; weight: number }[] = [
    { ruleType: "max_consecutive_periods", parameters: { max: 3 }, isHard: true, weight: 100 },
    { ruleType: "max_subject_periods_per_day", parameters: { max: 2 }, isHard: true, weight: 100 },
  ];
  let ruleCount = 0;
  for (const rule of ruleDefs) {
    const existing = await prisma.schoolTimetableRule.findFirst({
      where: { schoolId: school.id, ruleType: rule.ruleType },
    });
    if (!existing) {
      await prisma.schoolTimetableRule.create({
        data: { schoolId: school.id, ...rule, parameters: rule.parameters },
      });
      ruleCount++;
    }
  }
  console.log(`  Created ${ruleCount} timetable rules.`);

  // --- Room Types & Rooms ------------------------------------------
  let roomType = await prisma.roomType.findFirst({ where: { schoolId: school.id, name: "Science Lab" } });
  if (!roomType) roomType = await prisma.roomType.create({ data: { schoolId: school.id, name: "Science Lab" } });
  let compLab = await prisma.roomType.findFirst({ where: { schoolId: school.id, name: "Computer Lab" } });
  if (!compLab) compLab = await prisma.roomType.create({ data: { schoolId: school.id, name: "Computer Lab" } });
  const roomDefs = [
    { name: "Lab 1", typeId: roomType.id, capacity: 40 },
    { name: "Lab 2", typeId: roomType.id, capacity: 30 },
    { name: "ICT Hub", typeId: compLab.id, capacity: 25 },
  ];
  for (const rm of roomDefs) {
    const existing = await prisma.room.findFirst({ where: { schoolId: school.id, name: rm.name } });
    if (!existing) {
      await prisma.room.create({ data: { schoolId: school.id, name: rm.name, roomTypeId: rm.typeId, capacity: rm.capacity } });
    }
  }
  console.log("  Created room types and rooms.");

  // ======================================================================

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("  Super Admin: super@marksheet.dev / superadmin123");
  console.log("  School Admin: admin@ums.edu.ng / admin123");
  console.log("  Teachers:");
  for (const t of teacherDefs) {
    console.log(`    ${t.name}: ${t.email} / teacher123`);
  }

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
