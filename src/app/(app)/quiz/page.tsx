import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isAddonActive } from "@/lib/addons/check";
import { getAvailableQuizzesAction } from "@/lib/quiz/actions";
import { QuizClient } from "./quiz-client";

export default async function QuizPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.schoolId || !(await isAddonActive(user.schoolId, "Assessment"))) {
    return (
      <p className="font-body-md text-body-md text-on-surface-variant">
        The Assessment addon is not active for your school.
      </p>
    );
  }
  const quizzes = await getAvailableQuizzesAction();
  return <QuizClient quizzes={quizzes} />;
}
