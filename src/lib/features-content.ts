/**
 * Deep-dive human explanations for /features/[slug].
 * Each feature's content is sourced from docs/features/*.md,
 * mapped into challenge / solution / helps sections.
 * Written in a warm, conversational tone any school proprietor,
 * principal or teacher in Nigeria can relate to.
 */

export interface FeatureDeepDive {
  challenge: string;
  solution: string;
  helps: string;
}

export const FEATURE_DEEP_DIVES: Record<string, FeatureDeepDive> = {
  exams: {
    challenge: `Marksheet gives schools a complete way to prepare and manage examinations, from creating the questions to releasing the final scores.

Teachers and examination officers can prepare exam papers, have them reviewed before release, give students access to the examination, and manage the marking process.

Before Marksheet, exam week meant late-night panic: papers arriving in three different fonts, a photocopier jamming at 10 pm, and teachers marking 150 scripts by hand — one slipped digit and a student's whole term total is ruined, with nobody noticing until the PTA meeting.`,

    solution: `An examination is first prepared by the examination officer and then sent for review. Once approved and published, students in the selected classes can access it.

Multiple-choice questions are marked automatically, while essay answers receive AI-assisted marking suggestions that the teacher can review and confirm. This gives the school a structured examination process while keeping teachers involved in every important academic decision.

Teachers can build papers directly from the school's shared Question Bank, so every question already belongs to its proper subject, class level and syllabus topic. The paper moves through a clear chain: draft → review by the Head of Department → approved → scheduled.`,

    helps: `Less manual work: Objective questions are marked automatically, cutting the time teachers spend calculating scores.

Better control: Examinations can be reviewed and approved before students see them.

More organised exams: Papers are connected to the right class, subject and term.

Flexible marking: Teachers remain in control of essay scores and can change an AI suggestion when necessary.

Resits are easier to manage: A student's resit stays connected to the original examination.

In simple terms: Marksheet helps the school manage the entire examination process — from preparing the paper to marking students and producing their scores.`,
  },

  "results-grading-report-cards": {
    challenge: `Marksheet brings together students' assessment and examination scores and turns them into organised academic results.

The school can decide how different assessments contribute to the final result, calculate grades and positions, produce report cards and broadsheets, and provide a way for results to be verified.

Broadsheet week used to be the most stressful week of the school year — teachers huddled around a single laptop, praying the formulas calculating 30% continuous assessment and 70% exam were not broken, and debating who takes 3rd position when two students tie because there was no written tie-breaker rule.`,

    solution: `The school first decides how its different assessments should contribute to the final score. Teachers enter the students' scores, and Marksheet uses the school's settings to calculate the final subject results, grades and positions.

The results can then be compiled into a student's term report and a class broadsheet. Once a result has been finalised, the school can provide a verification code that can be used to confirm the result is genuine.

Schools can customise the appearance of their report cards with their own branding — logo, signature, stamp and preferred layout — so the reports look like official school documents rather than generic system-generated printouts.`,

    helps: `Faster result processing: Calculations that normally require manual work are handled automatically.

Fewer calculation errors: Scores, grades and positions are calculated consistently based on the school's settings.

Professional report cards: Schools produce branded report cards and broadsheets.

Easy verification: Final results can be checked using a verification code.

Better control: Schools can manage when results are finalised or withheld.

In simple terms: Marksheet takes students' scores and turns them into properly calculated, graded and printable school results that can also be verified as genuine.`,
  },

  "curriculum-syllabus": {
    challenge: `Every school has an official syllabus, but it usually lives as a dusty book in the principal's office or a massive PDF forwarded on WhatsApp that teachers rarely open. Instead, teachers write their own schemes of work in notebooks, and the schemes begin to drift.

A topic like "Equations" is taught in JSS2A in week 3, JSS2B in week 5, and JSS2C skips it entirely because the teacher was sick for a week and ran out of time. At the end of the term, the academic committee asks every teacher "Have you covered the syllabus?" and the answers are always vague — "We are on track," or "We are almost done." Nobody actually knows if the SSS3 Chemistry class is ready for WAEC until the mock results show massive gaps.`,

    solution: `Marksheet helps schools organise their curriculum, keep track of what has been taught and manage lesson notes in one place. The system supports curriculum content aligned with NERDC references while also allowing schools to manage their own curriculum information.

The school can have its curriculum organised by subject and class level. Teachers can then follow the curriculum as they teach throughout the term. As lessons are completed, teachers can mark topics as taught, giving the school a clearer picture of how much of the curriculum has been covered and what remains.

Syllabuses can also be uploaded and organised so that teachers have a structured reference for what they are expected to teach.`,

    helps: `Better curriculum planning: Teachers have a clearer view of what they are expected to teach.

Track teaching progress: School administrators can see whether topics are being covered during the term.

More organised lesson preparation: Lesson notes and syllabus information can be managed within the school system.

Greater accountability: Class-captain verification provides an additional check on recorded teaching progress.

AI-assisted preparation: Teachers can get assistance when preparing lesson notes.

In simple terms: Marksheet helps the school know what should be taught, what has been taught, and keeps teachers' lesson preparation organised along the way.`,
  },

  "lesson-notes": {
    challenge: `Writing lesson notes is the bane of a teacher's weekend. On Sunday evening, instead of resting, a teacher sits with three different textbooks trying to handwrite or type lesson plans into Word files. Because there is no standard system, every teacher writes differently — one writes detailed teaching steps while another writes a brief summary with no clear learning objectives.

HODs are handed a heavy pile of notebooks or a flood of WhatsApp files to review. They do not have the time to read through hundreds of pages of prose, so they sign them off with a quick glance and a stamp, offering no real academic guidance. When a teacher leaves mid-term, they take their files with them and the replacement teacher arrives on Monday guessing what the students already know.`,

    solution: `Marksheet provides a single, professional template for every lesson note. Every note must include clear behavioural objectives, reference materials, teaching aids, prior knowledge, step-by-step presentation and a matching evaluation. This structure is built into the portal, making notes easy for teachers to write and simple for HODs to review.

Teachers can also get AI assistance when preparing lesson notes, helping them organise their teaching content more efficiently. As lessons are completed, teachers can mark topics as taught, and the class captain can verify that the topics recorded as taught were actually covered — creating an additional layer of accountability around curriculum coverage.`,

    helps: `More organised lesson preparation: Lesson notes and syllabus information can be managed within the school system.

Greater accountability: Class-captain verification provides an additional check on recorded teaching progress.

AI-assisted preparation: Teachers can get assistance when preparing lesson notes.

Teachers get their Sundays back: Instead of rewriting the same basic notes every year, they can copy approved notes from the previous session, make quick improvements based on HOD feedback, and submit them in minutes.

In simple terms: Marksheet helps the school keep teachers' lesson preparation organised and accountable throughout the term.`,
  },

  "students-staff-parents-promotion": {
    challenge: `Schools often have thousands of pieces of information about students, teachers and parents. Keeping these records organised makes it easier to connect the different parts of the school system.

A student's academic results, homework, attendance and parent access can all relate back to the correct student record. At the end of an academic session, schools need to move students into their next classes — and students who need to move between branches of the same school group need to be transferred too.

Before Marksheet, managing school records on paper or loose spreadsheets was a recipe for duplicate names and lost history: a secretary registers a child as "Chiamaka Okafor" in JSS1, the bursar types "Chioma Okefor" on the fee receipt, and the class register says "Chy Okafor." By week 12, the system treats them as three different children.`,

    solution: `Marksheet provides the school with one organised place to manage its students, staff and parents.

For students: The school can maintain records including admission information, class and current status. Schools can register students, import records in bulk, view individual information, transfer students when necessary, keep track of whether a student is active, withdrawn or graduated, identify class captains and vice class captains, and manage student movement between classes and sessions.

For staff: The school can maintain records for members of staff and their school responsibilities, including assignments and staff availability information useful for organising the school timetable.

For parents: Parents can be connected to the students they are responsible for, so a parent can access information about their child or children through the parent portal. A parent with more than one child can have those children connected to the same parent account.

For promotion: Marksheet provides a promotion process for moving students from one class or session to another while keeping a record of the promotion.`,

    helps: `One organised record: Keep important information about students, staff and parents within the school system.

Easier student management: Register, update and transfer students without relying entirely on separate spreadsheets.

Better parent connection: Link parents and guardians to the students in their care.

Simpler promotion: Move students into new classes when the academic session changes.

Supports growing schools: Student and staff records can be managed as the school grows.

In simple terms: Marksheet helps the school keep its people organised — from students and teachers to parents — while making everyday student management and promotion easier.`,
  },

  "class-subjects": {
    challenge: `Not every student in a school necessarily takes exactly the same subjects. A school may have different departments or subject combinations, particularly at higher class levels.

JSS classes take general subjects, but SSS classes split into science, art and commercial departments. If there is no clear system rule, chaos reigns — the results officer has to manually delete "Literature in English" from a Science student's report card, or a Commercial student gets an overall class position dragged down by a Chemistry class they never took.

Timetables suffer from the same lack of structure: a coordinator accidentally schedules "Financial Accounting" for an Art class that does not offer it, and the clash is only discovered on Monday morning when two teachers walk into the same room.`,

    solution: `Marksheet allows the school to define which subjects belong to each class and organise them according to the school's academic structure. This helps ensure that students are assessed in the right subjects and that academic records are connected to the correct class and department.

The school determines which subjects are taught in each class. Once the subjects are assigned, Marksheet uses that structure when handling academic activities such as result processing. The system knows exactly which subjects should be considered for a particular class.`,

    helps: `Clear academic structure: Know exactly which subjects belong to each class.

Supports different departments: Schools can organise subjects according to their academic areas.

More accurate results: Student results can be calculated using the subjects assigned to their class.

Less confusion: Teachers and administrators have a consistent subject structure to work with.

In simple terms: Class-Subjects & Subject Assignment tells Marksheet what each class is supposed to study, so the rest of the academic system can work with the correct subjects.`,
  },

  "timetable": {
    challenge: `Marksheet helps schools organise their teaching timetable so that classes, subjects, teachers and rooms can be properly scheduled.

The school can create timetables manually or use the timetable generator to help produce a schedule automatically. Without a proper timetable, classes, teachers and rooms can end up in the wrong place at the wrong time — and nobody finds out until Monday morning.`,

    solution: `The school can create a timetable for each class, assign subjects to specific days and periods, assign teachers to lessons, assign rooms where necessary, set up the school week and available periods, define when teachers are available, and set rules for how the timetable should be arranged.

When the timetable generator is available, the school can provide information such as subjects, teacher availability, rooms and school timetable rules. Marksheet then uses this information to produce a proposed timetable while trying to respect the school's requirements. The school can review the generated timetable before using it and lock timetable slots that should not be changed.`,

    helps: `Better organisation: Keep class and teacher schedules in one place.

Reduce timetable conflicts: The generator can consider teacher availability, rooms and other school requirements.

Save time: Instead of manually arranging every lesson, the generator can create a timetable proposal.

Easy access: Teachers and students can view the timetable relevant to them.

In simple terms: Marksheet helps the school organise who teaches what, where and when — either manually or with assistance from an automatic timetable generator.`,
  },

  attendance: {
    challenge: `Marksheet gives schools a structured way to record student and staff attendance. Attendance can be taken manually or through QR-card scanning, depending on how the school chooses to operate.

Without a proper system, attendance lives in five different books, the percentage by Friday is a guess, and QR cards without a template just lengthen the gate queue.`,

    solution: `The school can record whether students are present or absent, take attendance for specific periods or on a daily basis, record staff attendance, use QR cards to make attendance recording faster, enter attendance for multiple students at once, view attendance in a spreadsheet-style format, print attendance records, export attendance information, and include attendance information in term results.

Teachers or authorised staff can record attendance directly in the system, using either daily attendance or per-period attendance. Schools can also configure QR ID cards for students so that authorised staff can scan a student's QR card to record attendance instead of manually finding each student on the attendance list.`,

    helps: `Better attendance records: Keep attendance information organised instead of relying entirely on paper registers.

Faster recording: QR scanning can speed up the process.

Flexible: Schools can use daily or lesson-by-lesson attendance.

Easy reporting: Attendance records can be viewed, printed and exported.

Connected to academic records: Attendance can form part of the student's term result.

In simple terms: Marksheet makes it easier for schools to record, review and report student and staff attendance without depending entirely on paper registers.`,
  },

  "period-tracker": {
    challenge: `A timetable can tell a school that a Mathematics lesson was scheduled. The Period Tracker goes a step further by helping the school know which topic was taught during that lesson.

Instead of only knowing that a lesson took place, the school can keep track of what was actually taught. This gives school administrators a clearer picture of curriculum coverage during the term.`,

    solution: `As a teacher progresses through the curriculum, they can record the topics they have taught. This creates a running record of the school's teaching progress.

The system also allows the class captain to verify recorded topics. If a teacher records that a particular topic has been taught, the class captain can confirm that the topic was actually covered — creating an additional layer of accountability around curriculum coverage.`,

    helps: `Track curriculum coverage: Know which topics have been taught and which still need attention.

Improve accountability: Recorded teaching progress can be verified by the class captain.

Keep teaching organised: Teachers have a structured way to record their progress.

Identify gaps: The school can more easily see when parts of the curriculum have not yet been covered.

In simple terms: The Period Tracker helps the school answer a simple but important question: "What has actually been taught so far?"`,
  },

  "question-bank": {
    challenge: `Instead of creating every examination paper from scratch, teachers and examination officers can build a collection of questions that can be reused when preparing assessments. Without a central place, questions are scattered across different documents and every paper starts from zero.`,

    solution: `The Question Bank gives the school a central place to create, organise and manage examination questions. Teachers can create and store questions, organise them into groups, create multiple-choice and essay questions, add answer options, provide marking information for essay questions, import multiple-choice questions in bulk, review questions before they are approved, and keep older questions archived rather than losing them.

Questions can be organised into groups and connected to supporting material where necessary. Schools can also import many multiple-choice questions at once instead of entering them individually. A question can move from preparation to review, then approval. Questions that are no longer needed can be archived.`,

    helps: `Save preparation time: Build a question library that can be used when creating future examinations.

Keep questions organised: Questions are stored in a structured collection instead of being scattered across different documents.

Support different assessment types: Both multiple-choice and essay questions are supported.

Bulk import: Existing multiple-choice questions can be brought into the system in large numbers.

Better quality control: Questions can be reviewed before they are approved for use.

In simple terms: The Question Bank is the school's reusable library of examination questions, making it easier to prepare quality assessments without starting from zero every time.`,
  },

  messaging: {
    challenge: `School communication can become difficult to manage when conversations are spread across different platforms. Keeping messages within the school portal makes it easier to connect communication with the rest of the school's activities.

Instead of relying on separate messaging platforms, important school conversations can take place within the same system where academic and administrative information is already managed.`,

    solution: `Marksheet provides a built-in messaging system that allows members of the school community to communicate through the school portal. Users can access their messaging inbox to see their conversations, start new conversations, and continue them in one place.

When starting a new conversation, the system helps users find the appropriate recipient. Conversations can involve relevant members of the school community — staff, parents or students — according to the access available to each user. Users can keep track of messages that have been read or are still unread.`,

    helps: `Centralised communication: Keep school-related conversations within the school system.

Easier communication: Users can find the people they need to contact and start a conversation.

Organised inbox: Messages and conversations are kept together instead of being scattered across different channels.

Better continuity: Users can return to previous conversations when they need to review what was discussed.

In simple terms: Marksheet gives the school its own communication space, keeping important conversations closer to the academic and administrative information they relate to.`,
  },

  "support-tickets": {
    challenge: `When a problem is reported informally, it can be difficult to remember who is handling it or whether it has been resolved. Instead of important requests getting lost in ordinary messages or verbal conversations, they can be recorded and managed as support requests.`,

    solution: `The Support Ticket system gives users a structured way to report problems, ask for help and follow up on issues that need attention. A user creates a ticket and provides information about the issue. The request can be assigned to the appropriate person for handling.

Support requests can have different priorities and categories, making it easier for the school or platform support team to organise the work that needs to be done. Responses remain connected to the original request, so the conversation and the issue stay together.

School users can manage their support requests from the school's support area, and platform administrators can also manage support requests from their own area when an issue requires assistance from the platform team.`,

    helps: `Problems are less likely to be forgotten: Each request has its own record.

Clear responsibility: Requests can be assigned to someone responsible for handling them.

Better organisation: Issues can be categorised and prioritised.

Conversation stays with the problem: Responses remain connected to the original request.

Better follow-up: The school can keep track of outstanding issues instead of relying on memory.

In simple terms: Support Tickets turn "I have a problem" into a trackable request that can be assigned, handled and followed through to resolution.`,
  },

  "school-settings-announcements": {
    challenge: `Every school has its own identity, academic practices and communication needs. Rather than forcing every school to operate in exactly the same way, Marksheet provides settings that allow the school to configure important parts of its experience.

Before Marksheet, the principal's signature image was the wrong size on the report cards, the school logo on the letterhead was stretched out of shape, and nobody remembered whether an A was 75% or 80% this term. When the proprietress changed the fee structure, the bursar updated the Excel sheet but the exam officer never saw the change — and students were blocked from the exam gate because of a mismatch nobody noticed until Monday morning.`,

    solution: `Marksheet gives each school the ability to manage important settings, customise its identity and communicate announcements to the people who need to see them. The school can control things such as its branding, grading system and certain result or examination settings from one place.

For branding: The school can customise elements used in its school documents, including its logo, signature, stamp and other report-card settings, so official school documents maintain the school's own identity.

For grading: Schools can manage the grading system used when student results are calculated, so the academic results follow the school's grading structure.

For announcements: Schools can publish announcements through the portal to communicate important information. Announcements can be directed towards particular groups or roles, can be made prominent when necessary, and can have a publication and expiry period.

For accountability: Marksheet keeps an audit trail of relevant activities within the system, providing a record that can be reviewed when necessary.`,

    helps: `Make it your school's portal: Use the school's own branding and report-card presentation.

Control grading: Set the grading approach used by the school.

Communicate effectively: Publish announcements to the appropriate people.

Reduce unnecessary messages: Target announcements according to user roles.

Maintain accountability: Keep a record of important activities within the system.

In simple terms: School Settings & Announcements gives the school control over how its portal looks, how important academic settings work and how information is communicated to its community.`,
  },

  landing-public-flows: {
    challenge: `Marksheet's public-facing features provide the entry points that visitors, prospective schools and members of the public use before or outside the main school portal. These include the public landing page, school registration, demo requests and result verification.

Without a proper public face, prospective schools cannot learn about Marksheet, begin registration, request a demonstration or verify a student's result — all from outside the main portal.`,

    solution: `Visitors can learn about Marksheet from the public landing page, see important platform statistics displayed on the homepage, begin the process of registering a school, submit a demonstration request, and verify a student's final result using a verification code — all without needing to enter the main school portal.

Schools interested in using Marksheet can begin their registration through the public registration process, which provides the information needed to start onboarding and supports the available payment and referral options. The landing page can display important numbers about the platform — the number of schools, students and verifications — which can be managed by the platform and can either come from live platform information or be manually provided.`,

    helps: `Easy introduction: Prospective schools can learn about the platform before signing in.

Simpler onboarding: Schools have a clear starting point for registration.

Lead generation: Interested schools can request a demonstration.

Result verification: Finalised results can be checked publicly using their verification code.

Professional presentation: The public-facing pages provide a dedicated space for the platform and its services.

In simple terms: The Landing Page & Public Flows handle everything that happens around the school portal — from discovering and registering for Marksheet to requesting a demo and verifying official results.`,
  },

  "fee-status": {
    challenge: `Marksheet helps schools see whether a student's fees have been paid in full, partially paid or are still outstanding. The fee position is based on the school's fee structure and the payments that have actually been recorded.

Before Marksheet, cleared vs not_cleared was a ticked box, not a number — and every exam entry and result release became a negotiation at the gate.`,

    solution: `The school defines the fees expected for each class level and term. When the bursar or authorised staff record a student's payments, Marksheet compares the amount expected with the amount that has been paid and determines the student's current position.

A student's fee position can show Cleared (the expected fees have been paid), Partial (some payment has been made but there is still a balance), Not Paid (the expected fees have not been paid), or No Structure (a fee structure has not been set up for the student's level). The system can also calculate the remaining balance and identify when payments exceed the expected amount.

Schools can choose whether outstanding fees should affect access to examinations or results. Where the school's fee settings require it, a student with an outstanding fee position may have access to certain academic information restricted until the relevant requirement has been met.`,

    helps: `Always based on payment records: The fee position reflects recorded payments rather than relying on manually updated labels.

Clearer financial picture: Staff can quickly see which students have cleared their fees and which still have balances.

Less manual work: The system calculates the student's status from the school's records.

Better parent communication: Parents can see their child's available fee information.

Supports school policies: Schools can use their fee settings to control access to examinations or results.

In simple terms: Fee Status gives the school and parents a clear picture of where a student's school fees stand, based on what is actually expected and what has been paid.`,
  },

  "data-imports-exports": {
    challenge: `Schools often already have years of information stored in spreadsheets and documents. Having import tools makes it easier to move relevant information into the platform instead of requiring everything to be entered manually. Export tools also make sure the school's information is not trapped inside the system.

Every new school session used to start with the secretary re-typing student names one by one from old handwritten registers — "Oluwaseun" becoming "Oluwason," names split across cells because of a stray comma.`,

    solution: `The system supports importing information such as student records, examination questions and multiple-choice questions in bulk. Schools can use provided templates to organise information before importing it.

Important school information can be exported in formats suitable for different purposes, including CSV, Word documents, PDF and Excel. Depending on the feature, exported information can include report cards, class broadsheets, attendance records and other supported school records.

A school with an existing student spreadsheet can use the supported student-import process to bring those records into the system. Similarly, examination questions can be imported in bulk. When information needs to be taken out of Marksheet, the school can export supported records into a format convenient for printing, sharing, storing or further use.`,

    helps: `Save time: Import many records instead of entering them one by one.

Easier transition: Existing student and question information can be brought into the platform.

Flexible reporting: Export supported information in formats commonly used by schools.

Easy printing and sharing: Create PDF, Word or spreadsheet versions of supported records.

Better record keeping: Keep copies of important school information outside the portal when needed.

In simple terms: Data Imports & Exports make it easier to bring existing school information into Marksheet and take important records out whenever the school needs to print, share or keep them elsewhere.`,
  },

  homework: {
    challenge: `Homework is an important part of learning, but it can become difficult to track when assignments are given through different channels. Marksheet keeps the assignment, submission and result connected to the student's school record.

Photocopied homework, taken by some, marked when time allows, scored in a notebook parents never see, and re-set from memory with a new mistake in option C — that was the old way.`,

    solution: `Teachers can create homework for a class, set it for a particular subject and term, add multiple-choice and essay questions, use questions from the school's question bank or create questions specifically for the homework, set a due date, publish homework when it is ready, review students' submissions, automatically mark multiple-choice questions, mark essay questions manually, and publish completed scores for students and parents to see.

The teacher first prepares the homework and decides which class, subject and term it belongs to. The homework can remain private while it is being prepared. When the teacher is ready, it is published and becomes available to the students it was assigned to. Students can then open the assignment, answer the questions and submit their work.`,

    helps: `Keep homework organised: Assignments are connected to the right class, subject and term.

Save marking time: Multiple-choice questions can be marked automatically.

Support different types of work: Teachers can combine objective questions with essays.

Better visibility for parents: Parents can see their child's homework status and published scores.

One connected process: Create, publish, submit, mark and share homework from the same system.

In simple terms: Marksheet turns homework from something that can easily get lost in notebooks, messages or loose papers into a structured part of the school's academic system.`,
  },

  "bursary-fee-management": {
    challenge: `The Bursary & Fee Management module gives the school a central place to define what students are expected to pay, record payments and keep track of outstanding balances. It also helps the school send regular fee reminders and, where the school chooses, control access to examinations or results based on fee requirements.

Before Marksheet, the bursary was the noisiest office in the school — parents crowding the window with bank transfer receipts, the list compiled at 9 am already wrong by 10 am because three parents made transfers and the receipts hadn't reached the desk.`,

    solution: `The school first defines the fees expected for each term and class level, including the different charges that make up the total amount a student is expected to pay. When a payment is received, the bursar or authorised staff member records it in Marksheet. The system then compares the expected amount with the amount paid and determines the student's current position — Cleared, Partial or Not Paid — and can also calculate the remaining balance and recognise when payments exceed the expected amount.

Schools can configure regular reminders for outstanding fees, choosing the day on which reminders should run and enabling or disabling the reminder system according to their needs. The school can also decide whether outstanding fees should affect access to examinations or results, and Marksheet can apply the school's fee policy when determining whether a student should be allowed access to those academic services.`,

    helps: `Centralised fee management: Keep fee structures and payment records in one place.

Clear financial picture: Quickly understand how much has been paid and what remains outstanding.

Less manual calculation: The student's fee position is determined from the expected fees and recorded payments.

Automated reminders: Regular fee reminders can help the school follow up on outstanding payments.

Better parent visibility: Parents can see the available fee information for their children.

Supports school policy: Schools can decide whether fee requirements should affect access to examinations or results.

In simple terms: Bursary & Fee Management helps the school know what each student should pay, what has actually been paid, what is still owed and how to follow up — all from one place.`,
  },

  "mobile-app-push-notifications": {
    challenge: `Parents, students and school staff can use the Marksheet mobile app to receive important school notifications directly on their phones. Instead of depending mainly on SMS or WhatsApp messages, the school can send notifications through the app at no per-message cost.

When something important happens in the school portal, the relevant person can receive an instant notification on their phone. Tapping it takes the user into the relevant part of the school portal.`,

    solution: `When something important happens in the school portal, the relevant person can receive an instant notification on their phone. For example: a student's result has been released, a new school announcement has been posted, homework or an academic update is available, the school has sent an important message, or other important updates are available in the portal.

The notification appears directly on the phone's notification area. Tapping it takes the user into the relevant part of the school portal — so parents, students and staff are all connected without the school having to pay for every notification.`,

    helps: `Faster communication: Important updates can reach users immediately.

Lower communication costs: App notifications do not carry the same per-message cost as SMS.

Better engagement: Parents and students can be reminded about important activities instead of having to constantly check the portal.

One place for communication: The notification leads users back to the school's portal, where they can see the full information.

Works for different users: Parents, students and staff can each receive notifications relevant to them.

In simple terms: Marksheet turns the school portal into a more direct communication channel between the school and its users — helping important information reach the right person quickly, without the school having to pay for every notification.`,
  },
};

// Keep alias for old combined slug
export const FEATURE_DEEP_DIVES_ALIAS: Record<string, string> = {
  "curriculum-syllabus-lesson-notes": "curriculum-syllabus",
};

export function getFeatureDeepDive(slug: string): FeatureDeepDive | undefined {
  if (slug === "curriculum-syllabus-lesson-notes") return FEATURE_DEEP_DIVES["curriculum-syllabus"];
  return FEATURE_DEEP_DIVES[slug];
}
