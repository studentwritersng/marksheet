import Link from "next/link";
export function TakeQuizCard() {
  return (
    <Link href="/quiz" className="block bg-primary text-on-primary rounded-2xl p-5 font-label-md text-label-md">
      Take Quiz →
    </Link>
  );
}
