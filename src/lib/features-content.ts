/**
 * Deep-dive human explanations for /features/[slug].
 * Written in a warm, conversational, jargon-free tone that any school proprietor,
 * principal, or teacher can instantly relate to. Focuses entirely on real school life,
 * staff room realities, and parent communication in Nigeria.
 */

export interface FeatureDeepDive {
  challenge: string;
  solution: string;
  helps: string;
}

export const FEATURE_DEEP_DIVES: Record<string, FeatureDeepDive> = {
  exams: {
    challenge: `Ask any exam officer what the exam week feels like, and they will tell you about the late-night panic. You have teachers rushing to submit question papers on Friday afternoon for a Monday morning exam. The papers arrive typed in three different fonts, some with five multiple-choice options, others with four, and instructions like "answer all questions" printed on a paper that only has three sections. Then the photocopier jams at 10:00 PM, and the exam office is left sorting, stapling, and sealing questions into brown envelopes by candlelight because the generator fuel ran out.

By the time the papers land on the student desks, nobody can guarantee that the version on the paper is the version the Head of Department actually moderated. And if a student is sick and misses the Tuesday paper, setting a separate makeup exam means a teacher has to go back, search through old files on a flash drive, and hope they find the correct draft. 

Then comes the heavy burden of marking. A teacher sits with a red pen and 150 scripts, grading late into the night. They total the marks on a calculator, write them in a paper register, and then copy those totals into a computer spreadsheet. One finger slip—writing 14 instead of 41—and a student’s entire term total is ruined, with nobody realizing the mistake until the parents are screaming at the end-of-term PTA meeting.`,

    solution: `Marksheet turns the entire exam cycle into a clean, guided process. Instead of setting exams in scattered Word documents, teachers build papers directly from a shared Question Bank. Every question already belongs to its proper subject, class level, and syllabus topic. If it’s an essay question, it carries its own marking guide and rubrics right alongside it, so the model answer is never lost on a separate sheet of paper.

The exam paper moves through a clear chain of review. A teacher drafts it, the Head of Department receives a notification to review and moderate it, and only when it is officially approved can it be scheduled. If the HOD rejects it, the paper goes back to the teacher with simple notes on what to fix.

When it’s time to take the exam, you have two options. You can print a beautifully typeset paper in one click, or deliver it on tablets and computers. If you choose the screen, you can turn on shuffling. This means the student on the left and the student on the right see the questions and options in a completely different order, making cheating almost impossible. 

And if the school’s internet drops? Marksheet is built to keep going. The exam runs smoothly on the school’s local office network. Students submit their answers, multiple-choice questions are graded instantly by the system, and essay answers are queued up for the teacher. When the internet returns, everything syncs back to the cloud automatically, with secure timers ensuring no student gets extra minutes by turning their device off and on. 

For theory and essay questions, the system reads the student's typed response against the teacher's model answer and marking rubric. It suggests a fair score with simple reasons, and hands it to the subject teacher. The teacher has the final say—they can accept the suggestion or type their own score, keeping the human teacher in absolute control.`,

    helps: `The most immediate change is staff room peace. Exam week stops being a race against a jammed printer and becomes a quiet, scheduled event. The question paper that lands on the desk is exactly the one the HOD approved, with consistent formatting, clear instructions, and the correct mark allocations already printed.

Teachers get their evenings back. Multiple-choice questions are graded the second the student clicks submit. Essay questions arrive on the teacher's dashboard already organized with the student's answer side-by-side with the marking guide, reducing hours of manual red-pen grading into a focused review session.

For the school’s reputation, the transformation is massive. Parents no longer have to wait weeks to hear how their children performed. Results can be ready days after the last paper. And if a parent queries a score, the school doesn’t have to dig through dusty cupboards for a physical script. You simply open the student’s portal, show the exact option they chose, the essay they wrote, and the rubric points the teacher confirmed.`,
  },

  "results-grading-report-cards": {
    challenge: `Broadsheet week is the most stressful week of the school year. You have teachers huddled around a single laptop in the staff room, reading raw scores aloud while another types them into a massive, complicated spreadsheet. Everyone is praying that the formulas used to calculate the final scores—taking 30% from continuous assessment and 70% from the exam—were not broken when a row was dragged or deleted. 

Then comes the manual grading. A teacher has to look at every student's total and decide if 69.5% rounds up to an A or stays as a B, leading to inconsistent grading between classes. If two students tie on the same overall average, deciding who takes 3rd position and who takes 4th becomes a long debate in the principal's office because there is no written tie-breaker rule.

By the time the report cards are printed, they are often a messy mix of fonts, with the principal’s signature image stretched out of shape or placed crookedly on the page. And once those report cards leave the compound, the school is vulnerable. If a student duplicates a report card on a computer, changes an F9 to a C6, and presents it to a parent or a bank, the school has no quick way to prove the document is a forgery without digging through paper files from three terms ago.`,

    solution: `Marksheet automates the entire grading and ranking process, taking the math out of the teachers' hands. The school defines its continuous assessment weightings once—for example, 15% for test one, 15% for test two, and 70% for the exam. The school’s grading scale is locked into the central settings, ensuring that a score of 70% is treated as an A across every single class, with no exceptions.

Teachers only enter raw, physical scores—the actual mark the student got on the test or the paper. From there, the system does the calculation. It automatically applies the weightings, looks up the correct grade band, determines the exact position of each student within the class, breaks ties using consistent rules, and rolls everything into a final term result. It even pulls the teacher’s comments and attendance summary into place.

The report cards are printed in a standard, professional layout using the school’s official logo, signature, and stamp, which are loaded directly from your settings. If the principal changes, you upload the new signature once, and every card printed from that second carries the new name.

Most importantly, every published report card is given a unique, secure verification code. If a parent, an employer, or a university wants to check if a report card is genuine, they don’t need to call the school or send an email. They simply go to the public verification page on your website, type the code, and get an instant, secure confirmation of the student's name, class, session, and final grades.`,

    helps: `The principal can finally relax during broadsheet week. What used to take days of double-checking formulas is finished the moment the last teacher enters their raw scores. The broadsheet balances perfectly on the first try, with no hidden calculation errors or missing rows.

Teachers are spared the tedious work of calculating percentages, looking up grades, and ordering students from 1st to 40th position. They can focus their energy on writing meaningful, personalized comments for each child.

Parents get report cards they can read and respect. The grades are consistent, the positions are clear, and the signature sits perfectly on the line. The school is protected from forgery forever; any attempt to alter a grade on a printed card is immediately exposed the moment the parent or a bank types the verification code into the portal. Your report card becomes a trusted, professional document that represents the true standard of your school.`,
  },

  "curriculum-syllabus": {
    challenge: `Every school has an official syllabus, but it usually lives as a dusty, 400-page book in the principal's office or a massive PDF forwarded on WhatsApp that teachers rarely open. Instead, teachers write their own "schemes of work" in notebooks. Because there is no central tracking, the schemes begin to drift. A topic like "Equations" is taught in JSS2A in week 3, JSS2B in week 5, and JSS2C skips it entirely because the teacher was sick for a week and ran out of time.

At the end of the term, the academic committee has to ask every teacher: "Have you covered the syllabus?" The answers are always vague. "We are on track," or "We are almost done." Nobody actually knows if the SSS3 Chemistry class is prepared for their WAEC exams until the mock results come out and show massive gaps in their knowledge. 

When a parent complains that their child was tested on something they were never taught, the school has no objective record to check. You are left trying to mediate an argument between a defensive teacher and an angry parent, with no real evidence of what actually happened in the classroom.`,

    solution: `Marksheet pre-loads the standard NERDC national curriculum directly into your portal, turning the syllabus into a live guide instead of a forgotten document. The school uploads its termly scheme of work once per subject and class level. The system breaks this scheme down week by week, linking every topic to the official curriculum.

Teachers track their progress as they teach. When a teacher finishes a class, they go to their portal and mark the specific topic as "taught." But it doesn't end there. To ensure absolute honesty, the class captain—the student representative in the classroom—gets a notification on their portal to verify that the topic was indeed covered. 

This two-way check creates a live "Curriculum Coverage Map" for the principal. With one glance at a visual dashboard, the principal can see which classes are on track, which subjects are lagging behind, and exactly which topics have been verified by the students.`,

    helps: `The academic principal no longer has to guess if the school is ready for exams. In week 5, you can see that SSS3 Physics has only covered two of their scheduled five topics, allowing you to arrange extra classes or support before the end of the term.

New teachers get a clear roadmap the day they arrive. They don't have to guess what their predecessor taught; they open the portal and see the exact week, topic, and notes that were previously covered and verified.

For the proprietor, school inspections become completely stress-free. When the ministry inspector walks in and asks to see your curriculum compliance, you don't hunt for paper registers or loose lesson plans. You open the coverage map, show the exact NERDC topics taught week by week, and present a professional record of student-verified academic progress.`,
  },

  "lesson-notes": {
    challenge: `Writing lesson notes is the bane of a teacher's weekend. On Sunday evening, instead of resting, a teacher sits with three different textbooks, trying to handwrite or type lesson plans into Word files. Because there is no standard system, every teacher writes differently. One teacher writes detailed teaching steps, while another writes a brief summary with no clear learning objectives. 

HODs are then handed a heavy pile of notebooks or a flood of WhatsApp files to review. They don't have the time to read through hundreds of pages of prose, so they sign them off with a quick glance and a stamp, offering no real academic guidance or moderation.

When a teacher leaves the school mid-term, they take their files and notebooks with them. The replacement teacher arrives on Monday morning and has to start from scratch, guessing what the students already know, while the students suffer through repeated lessons or massive gaps in their notes.`,

    solution: `Marksheet provides a single, professional template for every lesson note in the school. Every note must include clear behavioral objectives, reference materials, teaching aids, prior knowledge, step-by-step presentation, and a matching evaluation. This structure is built into the portal, making notes easy for teachers to write and simple for HODs to review.

To save time, teachers can use the built-in AI assistant. But this is not a generic tool that writes textbook paragraphs. The AI is specifically trained on Nigerian secondary school standards and is shaped by "class-level guidance." If you generate a note for JSS1, the AI uses simple, relatable words and local examples. If you generate one for SSS3, it uses advanced terminology and exam-focused scenarios.

The note goes through a digital approval queue. The HOD receives the draft, reviews the structured sections, leaves specific comments, and approves it with a click. Only approved notes are marked as "published" and become available for the term.`,

    helps: `Teachers get their Sundays back. Instead of rewriting the same basic notes every year, they can copy their approved notes from the previous session, make quick improvements based on the HOD's feedback, and submit them in minutes. 

HODs can actually moderate. They open a clean queue of standardized drafts on their dashboard, see at a glance if the evaluation questions match the learning objectives, and leave helpful guidance for the teacher.

The school's academic knowledge remains inside the school. If a teacher leaves, their approved, syllabus-linked lesson notes are safely stored in the portal. The new teacher opens their dashboard on day one, sees exactly what was taught last week, and continues with the exact same lesson structure—ensuring the students never lose a single day of learning.`,
  },

  "students-staff-parents-promotion": {
    challenge: `Managing school records on paper or loose spreadsheets is a recipe for duplicate names and lost history. A secretary registers a child as "Chiamaka Okafor" in JSS1, the bursar types "Chioma Okefor" on the fee receipt, and the class register says "Chy Okafor." By week 12, the system treats them as three different children, and the secretary has to spend hours sorting out the mess.

Teachers face a different problem. A teacher is never just one thing—they teach Math to JSS2, are the class teacher for JSS1A, and are the HOD for Science. A simple school app with a flat "teacher" or "admin" role can't handle this complexity, so schools resort to dangerous workarounds like sharing the main administrator password or giving everyone access to everything.

Parents are often treated as an afterthought—just a phone number scribbled on the student's admission card. If a parent has three children in the school, their name is typed three times with three different phone numbers. When the school sends an emergency alert, the mother's phone rings for one child, the father's for the second, and the third child's alert goes to an old number that was never updated.

Promotion in September is the ultimate headache. Moving 300 children to their next classes by hand often results in spelling mistakes, lost historical report cards, and broken links between past performance and future progress.`,

    solution: `Marksheet treats every person in your school as a single, permanent identity with clear relationships.

Student registration happens once. Admission numbers are automatically generated based on the school's chosen format, ensuring they never duplicate or drift. Once a student is in the system, every other module—fees, exams, attendance, and reports—points back to that single student record.

Teachers are assigned specific "assignments" rather than broad roles. The system looks at their active assignments for the current term and automatically determines what they can see and click. A JSS1 class teacher can mark attendance for JSS1, but they cannot edit the math scores for SSS3.

Parents are treated as families. A single "Parent Account" is created and linked to all of their children. When Mr. Okafor logs in, he doesn't need three different passwords; he sees Chiamaka, Emeka, and Ada on a single dashboard, with their separate fees, results, and attendance clearly laid out.

September promotion is simplified into a guided transition. You load the promotion list, see a preview of who moves forward and who repeats, click confirm, and the children are moved to their new registers. The system automatically preserves their entire academic history behind them, keeping their JSS1 records safe even as they start JSS2.`,

    helps: `The school office stops typing. Names are registered once on day one and remain perfectly spelled all the way to graduation. 

Teachers only see the student registers they are assigned to, preventing accidental edits and keeping school records clean and secure. 

Parents feel valued and connected. They have a single portal to monitor all of their children's progress. Resumption notices and emergency alerts reach the primary guardian's phone instantly, eliminating the chaos of uncoordinated WhatsApp messages. 

When a former student returns three years after graduating to request a transcript, you don't need to search through cardboard boxes in the store. You type their name, open their permanent profile, and print their entire history in seconds.`,
  },

  "class-subjects": {
    challenge: `Managing subject offerings in secondary schools is surprisingly tricky. JSS classes take general subjects, but SSS classes split into science, art, and commercial departments. If there is no clear system rule, chaos reigns. The results officer has to manually delete "Literature in English" from a Science student's report card, or a Commercial student gets an overall class position that is dragged down by a Chemistry class they never took.

Timetables suffer from the same lack of structure. A coordinator accidentally schedules "Financial Accounting" for an Art class that doesn't offer it, and the clash is only discovered on Monday morning when two teachers walk into the same room and neither is wrong on their paper timetable.`,

    solution: `Marksheet uses "Class-Subjects" to map exactly which subjects are offered by which classes. You define this map once: "SSS2 Science offers Physics, Chemistry, Biology, and Further Math," while "SSS2 Art offers Literature, Government, History, and Christian Religious Studies."

Every other part of the system reads directly from this map. The exam module only allows teachers to set papers for subjects the class actually offers; the result engine knows exactly which subject scores to expect for each student; and the timetable wizard only schedules periods for subjects assigned to that specific class department.`,

    helps: `Report cards and broadsheets are clean and accurate on the first run. There are no stray subjects, no blank grade columns, and no incorrect class positions caused by department mismatches.

Timetabling conflicts are resolved before the term starts. The system simply will not allow you to schedule a subject for a class that does not offer it, keeping your Monday mornings quiet and productive.

If the school decides to offer a new subject or create a new department, the adjustment is made in a single table. It flows immediately to registers, timetables, and report cards with no manual spreadsheet adjustments required.`,
  },

  "bursary-fee-management": {
    challenge: `The bursary is often the noisiest office in the school, especially in the week before exams. You have parents crowding the window with bank transfer receipts, bursars searching through paper ledgers to see who has paid, and the principal asking for a list of debtors so they can write exam entrance slips. 

The list that was compiled at 9:00 AM is already wrong by 10:00 AM because three parents made transfers and the receipts haven't reached the desk. An owing student is stopped at the exam gate even though their father made a payment on Tuesday, leading to an embarrassing scene and an angry parent.

When the school sends fee reminders, it usually resorts to a generic broadcast on WhatsApp or SMS: "Dear parents, please pay all outstanding fees." This is highly ineffective. Parents who have fully paid feel annoyed; parents who owe a specific part-payment don't know if the school received their last deposit; and a parent with two children has no idea how much is outstanding for each child. The broadcast is treated as noise, and the fees remain unpaid.`,

    solution: `Marksheet connects your fee structure directly to your student records, payments, and communication, making the bursary completely silent.

First, you define your fee structure once per class level. For example, JSS2 fees consist of: Tuition (₦40,000), Books (₦10,000), and PTA Levy (₦2,000). The system automatically calculates the expected amount for every JSS2 student—you never have to type a student's total fees by hand.

When a parent pays, the bursar records the payment (cash, transfer with reference, or POS). The system immediately calculates the balance: expected fees minus amount paid. The student's fee status is automatically derived—cleared, partial, or unpaid—and updates across the entire portal instantly.

Reminders are personalized and highly specific. The system looks at your active student list, identifies who owes, groups them by family, and prepares a customized notification. Instead of a generic broadcast, Mr. Okafor receives a private, polite message: "Dear Mr. Okafor, Chiamaka Okafor (JSS1A) has an outstanding balance of ₦30,000 for Tuition. Please settle before Friday." If he has two children, both are listed with their individual balances and a clear total. You can send these reminders manually in one click or set them to go out automatically on a specific day of the week.`,

    helps: `The bursar’s desk becomes a calm, organized workspace. Recording a payment once immediately updates the parent's dashboard, the student’s exam gate, and the reminder list with no extra paperwork.

Exam week is quiet. If you choose to turn on the fee gate, the portal automatically determines who is cleared to write the exam based on their live balance. There are no paper slips to print, no manual lists to check, and no mistakes at the gate.

Fee collection improves dramatically. Parents pay faster because they receive polite, accurate, and highly specific reminders showing exactly what they owe and what they have already paid. The proprietor has a live, real-time view of expected vs collected fees for the term, allowing for confident financial planning.`,
  },

  "school-settings-announcements": {
    challenge: `The school knows what it wants to be called, what an A means, and when parents should hear from it—until those three things live in five different places and a notice meant for parents is accidentally sent to all staff as a company-wide announcement.

The principal's signature image is the wrong size on the report cards, the school logo on the letterhead is stretched out of shape, and nobody remembers whether an A is 75% or 80% this term. When the proprietress changes the fee structure, the bursar updates the Excel sheet but the exam officer never sees the change, and students are blocked from the exam gate because of a mismatch nobody noticed until Monday morning.

An important message about a two-week holiday break needs to reach only the parents of the boarding students—quietly, privately. Instead, it goes out on the school's public WhatsApp status where everyone sees it, or worse, gets buried in a long group chat thread.`,

    solution: `Marksheet gives the school one single home for everything that defines the school's identity and rules. In the School Settings section, you upload the logo, signature, and stamp image once. You choose the school's grading scale—for example, whether 70% is an A or a B—and that choice flows everywhere automatically to report cards, broadsheets, and the public verification page.

You also set the rules for when fees block access to exams or results. Change the rule once, and every gate across the portal updates immediately without anyone having to touch a separate spreadsheet.

The Announcements section is built for real communication, not loud broadcasts. You choose exactly who should see the message—parents only, teachers only, boarding students, a specific class, or anyone with an outstanding fee balance. You can even "pin" an important notice so it sits at the top until it expires. Every announcement and every change you make to the school settings is quietly recorded in an audit log, so you can always see who changed what and when.`,

    helps: `The school finally speaks with one voice. Parents and staff see the correct logo, the signature is placed properly on every document, and grades are defined consistently across the entire school.

Changes happen in one place and flow everywhere at once. When the fee-gate rule changes, exam blocks and result releases adjust automatically—no more Monday morning surprises at the gate.

Communications become private and trustworthy. A boarding parent receives a quiet, targeted notice about the holiday schedule, not a public broadcast. And if anyone ever asks "who changed the grading scale?", the audit trail gives a clear, dated answer with a single click.`,
  },

  "data-imports-exports": {
    challenge: `Every new school session starts with the secretary sitting at a desk, re-typing student names into the system one by one from old handwritten admission registers. Names like "Oluwaseun" become "Oluwason," "Adebayo" becomes "Adebayo," and "Chukwuma" gets split across two cells because of a stray comma in the middle of the name.

By the time the list is finished, there are forty students on paper but only thirty-eight unique names in the system. The bursar spends an entire afternoon chasing down the missing two, and the teacher who received the class roster has the wrong number of names on it.

At the end of the term, the principal wants to see the broadsheet and the bursar wants a financial summary. The secretary exports a messy spreadsheet where names are duplicated, some students appear twice, and the total fees don't add up. Nobody trusts the numbers, so everyone re-checks everything by hand.`,

    solution: `Marksheet makes data entry safe and simple. You download a clean, pre-formatted CSV template that already has the right column names and order. You fill it in on your computer—names, admission numbers, class assignments, and parent phone numbers—then upload it.

Before anything touches your real student records, Marksheet reads every single row and gives you a clear "Staging Report." If row 14 says the student's class was not found, row 22 has a duplicate admission number, or row 31 has a phone number with the wrong number of digits, you see every single problem listed in one place with the exact row number and what went wrong. You fix only the mistakes on your computer, re-upload, and the system confirms that everything is clean. Only then does it commit—meaning your live register stays perfect.

For getting data back out, Marksheet lets you export your students, results, fees, and report cards into clean files you can share or print—whether you need a spreadsheet, a Word document for the board, a PDF for the bank, or a plain text list.`,

    helps: `The secretary's Sunday afternoons of re-typing names disappear. Admission numbers generate themselves from the school's own format, and the staging report catches every mistake before it reaches the live records.

Week 1 starts cleanly. The bursar has the correct fee totals, the class teacher has the right student list, and the principal has a report that actually adds up—no chasing missing names, no duplicates, no arguments about whose spreadsheet is the real one.

At the end of the term, exporting becomes effortless. The broadsheet is a clean file you can print or send to the bank in a format they already use, and the financial summary matches the fee records perfectly.`,
  },

  timetable: {
    challenge: `To be written — 4 Timetable deep dive (not requested yet). The dream of a perfect schedule that fits every teacher, every room, and every subject without clashes is something every principal wishes for.`,
    solution: `To be written — will cover manual grid entry, the auto-solver using staff availability, subject requirements, rooms, and school rules, plus lockable entries. To be written in order 4.`,
    helps: `To be written — how a school goes from chaos to a clean, conflict-free timetable in minutes. To be written in order 4.`,
  },

  attendance: {
    challenge: `To be written — 5 Attendance deep dive (not requested yet). A register marked in five books must become one percentage by Friday, with spelling variants and unclear denominators, while QR cards without a template just lengthen the gate queue.`,
    solution: `To be written — will cover daily or per-period AttendanceRecord keyed to Student/Class/date, hand-mark or QR scan from IDCardTemplate, and bulk-marking with correct spelling. To be written in order 5.`,
    helps: `To be written — gate scan replaces copying, and the report card percentage matches the gate because both read the same denominator. To be written in order 5.`,
  },

  "period-tracker": {
    challenge: `To be written — 6 Period Tracker deep dive (not requested yet). "We covered the syllabus" ends as a debate, not a query, because the only evidence is a note written after the fact.`,
    solution: `To be written — will cover TaughtTopic marked by teacher then verified by class captain, with a live tracker grid scoped by subject and class. To be written in order 6.`,
    helps: `To be written — week 6 shows four unverified topics in one class vs none in another while there is still a term to catch up. To be written in order 6.`,
  },

  "question-bank": {
    challenge: `To be written — 7 Question Bank deep dive (not requested yet). Last year's good paper is this year's bad Word file — misaligned options, answer key on another page, no moderation note, and no provenance for which lesson note a hard question came from.`,
    solution: `To be written — will cover Stimulus → QuestionGroup → Question with McqOptions/EssayGradingSpec, draft→pending_review→approved→archived, and CSV staging with per-row error listing. To be written in order 7.`,
    helps: `To be written — moderation becomes a queue of approved questions, and two arms get same-outcome papers with proven grounding. To be written in order 7.`,
  },

  messaging: {
    challenge: `To be written — 10 Messaging deep dive (not requested yet). Broadcasts reach everyone and no one, with no thread to point at when a parent says "nobody told us."`,
    solution: `To be written — will cover Conversation → ConversationParticipant → Message, audience picker, live count, and {{variable}} rendering per recipient. To be written in order 10.`,
    helps: `To be written — 64 parents get 64 private threads each addressed by name, not a broadcast 300 reply-all to. To be written in order 10.`,
  },

  "support-tickets": {
    challenge: `To be written — 11 Support Tickets deep dive (not requested yet). Every request as a voice note means nothing has priority and nothing has a thread.`,
    solution: `To be written — will cover Ticket with status/priority/category, creator/assignee, and TicketMessages, scoped by school. To be written in order 11.`,
    helps: `To be written — history stays, leadership can measure tickets per week and category instead of asking around a group. To be written in order 11.`,
  },

  landing-public-flows: {
    challenge: `To be written — 13 Landing & Public Flows deep dive (not requested yet). A landing page that makes big promises and a portal that must keep them often behave like two products, with stats that cannot be verified and a checker that is not linked to the real result.`,
    solution: `To be written — will cover root routing by host/auth, landing_stats with auto/manual modes, sales-led /register, demo requests, and public /verify for finalised codes. To be written in order 13.`,
    helps: `To be written — prospects see a tour ending in a conversation, not a cart; parents verify a code on the spot. To be written in order 13.`,
  },

  "fee-status": {
    challenge: `To be written — 14 Fee Status deep dive (not requested yet). Cleared vs not_cleared as a ticked box, not a number, makes every exam entry and result release a negotiation.`,
    solution: `To be written — will cover FeeItem per level, StudentPayment, derived status, and gate.ts enforcement. To be written in order 14.`,
    helps: `To be written — recording a payment once updates every gate and badge. To be written in order 14.`,
  },

  homework: {
    challenge: `To be written — 16 Homework deep dive (not requested yet). Photocopied homework, taken by some, marked when time allows, scored in a notebook parents never see, and re-set from memory with a new mistake in option C.`,
    solution: `To be written — will cover Homework draft→published, HomeworkQuestions from bank or ad-hoc, student attempt with instant MCQ grading and teacher essay marking, and parent ward visibility. To be written in order 16.`,
    helps: `To be written — teachers reuse bank questions; students take the same paper without being in school; parents see status and score per ward. To be written in order 16.`,
  },

  "mobile-app-push-notifications": {
    challenge: `To be written — 18 Mobile & Push deep dive (not requested yet). SMS/WhatsApp per-message cost, muted groups and failed queues, plus a portal that cannot link the notification to the parent's existing conversation.`,
    solution: `To be written — will cover the mobile portal, push notifications, and direct linking to conversations. To be written in order 18.`,
    helps: `To be written — lock screen says the result is out and the tap opens the portal with the verification code. To be written in order 18.`,
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
