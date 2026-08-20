import { getQuizBankStats, topUpQuizBankAction } from "@/lib/quiz/actions";
import { prisma } from "@/lib/prisma";

export default async function ConsoleQuizPage() {
  const stats = await getQuizBankStats();

  // Live API usage for quiz_generation (last 30 days)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const usage = await prisma.aiCallLog.aggregate({
    where: { taskType: "quiz_generation", createdAt: { gte: since } },
    _sum: { promptTokens: true, completionTokens: true },
    _count: { _all: true },
  });
  const recentErrors = await prisma.aiCallLog.count({
    where: { taskType: "quiz_generation", status: "error", createdAt: { gte: since } },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Assessment — Quiz Bank</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Bank questions" value={stats.totalQuestions} />
        <Stat label="Topic coverage" value={`${stats.topicCoveragePct}%`} />
        <Stat label="Standard topics" value={stats.standardTopicCount} />
      </div>

      <form
        action={topUpQuizBankAction}
        className="bg-white border border-outline-variant rounded-2xl p-5"
      >
        <h3 className="font-label-md text-label-md text-on-surface mb-2">Top up bank</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
          Processes up to 20 standard topics lacking ≥5 live questions, generating MCQs via the AI gateway.
        </p>
        <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded font-label-sm text-label-sm">
          Run top-up batch
        </button>
      </form>

      <div className="bg-white border border-outline-variant rounded-2xl p-5">
        <h3 className="font-label-md text-label-md text-on-surface mb-2">API usage (last 30 days)</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Calls: {usage._count._all ?? 0} · Prompt tokens: {usage._sum.promptTokens ?? 0} ·
          Completion tokens: {usage._sum.completionTokens ?? 0} · Errors: {recentErrors}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-outline-variant rounded-2xl p-5">
      <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
      <p className="font-headline-md text-headline-md text-on-surface mt-1">{value}</p>
    </div>
  );
}
