import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | Marksheet",
  description: "The rules for using the Marksheet platform and public verification portal safely and lawfully.",
};

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      updated="4 August 2026"
      intro="This policy sets out the rules for using Marksheet. It applies to schools, staff, students, guardians and visitors to the public verification portal."
      sections={[
        {
          heading: "Keep accounts private",
          body: "Never share your login details or let someone else use your account. Do not log in as another user, and report suspected unauthorised access to support@marksheet.top.",
        },
        {
          heading: "Respect tenant boundaries",
          body: "Marksheet is tenant-isolated: each school can only see its own records. Do not attempt to access, copy or interfere with the data of another school or user.",
        },
        {
          heading: "No system abuse",
          body: "Do not attempt to probe, reverse-engineer, overload or disrupt the service. Automated scraping, credential guessing and denial-of-service behaviour are prohibited.",
        },
        {
          heading: "Content standards",
          body: "Only enter content that is lawful and appropriate for an academic platform. Do not upload content that is defamatory, harassing, obscene, infringing, or that contains malware or malicious scripts.",
        },
        {
          heading: "Accurate results",
          body: "Schools are responsible for the accuracy of scores, remarks and report cards they publish. Do not knowingly publish false or altered results, and use the platform's audit tools to review changes.",
        },
        {
          heading: "Consent for personal data",
          body: "Before uploading personal data of students, guardians or staff, obtain any consents required by law and by the Privacy Policy. Respect guardian consent choices recorded on the platform.",
        },
        {
          heading: "Verification portal",
          body: "The public verification portal exists to check published result summaries. Use it only to verify codes you have been given. Do not use it to probe or enumerate other schools' codes.",
        },
        {
          heading: "Reporting misuse",
          body: "If you see misuse, suspicious activity or a security issue, report it to support@marksheet.top as soon as possible. We will investigate and take appropriate action, which may include suspending access.",
        },
        {
          heading: "Changes",
          body: "We may update this policy as the platform or law changes. The date at the top of this page shows when it was last updated.",
        },
      ]}
    />
  );
}
