import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import Link from "next/link";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "platform_owner") redirect("/console");
    if (user.role === "referral") redirect("/referral/dashboard");
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-surface">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-container opacity-95" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32 text-center">
          <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
            <span className="material-symbols-outlined text-[48px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-white mb-4 tracking-tight">
            Marksheet
          </h1>
          <p className="font-body-lg text-body-lg text-white/90 max-w-2xl mx-auto mb-8">
            The complete academic portal for Nigerian secondary schools. Manage syllabus, lesson notes, examinations, and results — all in one place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/login" className="bg-white text-primary font-label-md text-label-md py-3 px-8 rounded-lg hover:bg-surface-container transition-colors shadow-lg">
              Sign In
            </Link>
            <Link href="/register" className="border-2 border-white text-white font-label-md text-label-md py-3 px-8 rounded-lg hover:bg-white/10 transition-colors">
              Register School
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-surface">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">Everything your school needs</h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
              From syllabus planning to result publishing, Marksheet streamlines every part of the academic workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "menu_book",
                title: "Syllabus & Curriculum",
                description: "Upload and manage syllabi, track curriculum coverage, and ensure every class stays on schedule.",
              },
              {
                icon: "note",
                title: "Lesson Notes",
                description: "Teachers create and share lesson notes with rich formatting. Students access notes anytime, anywhere.",
              },
              {
                icon: "quiz",
                title: "Question Bank & Exams",
                description: "Build exams from a rich question bank with MCQ and essay support. Auto-grading, manual override, and exam scheduling.",
              },
              {
                icon: "assessment",
                title: "Results & Grading",
                description: "Automated score computation, term summaries, psychomotor ratings, and beautiful report cards.",
              },
              {
                icon: "fact_check",
                title: "Attendance Tracking",
                description: "Daily student and staff attendance with QR sign-in, late marking, and comprehensive reports.",
              },
              {
                icon: "payments",
                title: "Billing & Fees",
                description: "Track student fees, manage payment records, and send automated reminders to parents.",
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-primary-container flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[28px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {feature.icon}
                  </span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">{feature.title}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-surface-container-low">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">Ready to transform your school?</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8 max-w-2xl mx-auto">
            Join schools across Nigeria using Marksheet to simplify academic management, save time, and deliver better results.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="bg-primary text-on-primary font-label-md text-label-md py-3 px-8 rounded-lg hover:bg-primary-container transition-colors shadow-md">
              Get Started
            </Link>
            <Link href="/login" className="border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md text-label-md py-3 px-8 rounded-lg hover:bg-surface-container transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-surface border-t border-outline-variant">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            © {new Date().getFullYear()} Marksheet. Built for Nigerian schools.
          </p>
        </div>
      </footer>
    </main>
  );
}
