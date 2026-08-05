import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Marksheet",
  description: "The terms that apply to schools using the Marksheet platform and to visitors of our public portal.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="4 August 2026"
      intro="These terms govern your use of Marksheet. By using the platform or the public verification portal you agree to them. If you use Marksheet on behalf of a school, you confirm that you are authorised to accept these terms for that school."
      sections={[
        {
          heading: "The service",
          body: "Marksheet is a software service that helps schools run the academic cycle: sessions and terms, syllabi, lesson notes, assessments, exams, results, attendance and report card publication. We add, change or retire features from time to time and will give reasonable notice of any change that materially affects your use.",
        },
        {
          heading: "Your account and records",
          body: "You are responsible for safeguarding your login details and for everything done under them. You must keep your school's records accurate and complete, and you are responsible for the content you enter into the platform, including the accuracy of results you publish.",
        },
        {
          heading: "Lawful use",
          body: "You agree to use Marksheet only for lawful purposes and in line with the Acceptable Use Policy. You must not attempt to access another school's records, probe or disrupt the service, or use the platform to store content that is unlawful or infringes the rights of others.",
        },
        {
          heading: "Fees and licensing",
          body: "Licensing is sales-led and arranged with our team. There is no online checkout. Fees are agreed before activation, and addons are activated per school as agreed. Fees are not charged automatically and there are no surprise renewals.",
        },
        {
          heading: "Registrations and refunds",
          body: "Registration applications do not create a payment obligation until our team confirms your school's onboarding with you. The Refund Policy explains the circumstances under which fees already paid may be refunded.",
        },
        {
          heading: "Data and privacy",
          body: "The Privacy Policy explains how we collect, use and protect personal data. Schools remain data controllers for their own records. You agree to obtain any consents required by law before uploading personal data of students and guardians.",
        },
        {
          heading: "Verification portal",
          body: "The public verification portal lets anyone check the summary attached to a report card code. The code confirms the published result summary only; it is not a guarantee of academic performance or of the authenticity of a printed document beyond the data stored on the platform.",
        },
        {
          heading: "Intellectual property",
          body: "Marksheet and its design, code, logos and documentation are owned by the Marksheet team. You may not copy, resell or create derivative services from the platform. Content you enter remains yours, and you grant us the limited rights needed to operate the service for you.",
        },
        {
          heading: "Availability",
          body: "We aim for high availability but do not guarantee uninterrupted service. We are not liable for delays caused by outages, maintenance, network issues beyond our control, or events outside our reasonable control.",
        },
        {
          heading: "Limitation of liability",
          body: "To the fullest extent permitted by law, our liability is limited to the fees you have paid in the twelve months before a claim. We are not liable for indirect or consequential losses, including lost profits or reputational harm.",
        },
        {
          heading: "Suspension and termination",
          body: "We may suspend access for serious or repeated breach of these terms, security risk, or non-payment, and will tell you as soon as practicable. On termination you may export your records during a reasonable wind-down period. Nothing in your records is deleted without your request.",
        },
        {
          heading: "Changes to these terms",
          body: "We may update these terms. Material changes will be announced in the application and, where relevant, to school administrators before they take effect. Continued use after changes take effect means you accept them.",
        },
        {
          heading: "Contact",
          body: "Questions about these terms can be sent to support@marksheet.sch.ng.",
        },
      ]}
    />
  );
}
