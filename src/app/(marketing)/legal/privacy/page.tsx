import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Marksheet",
  description: "How Marksheet collects, uses and protects personal data, in line with the Nigerian Data Protection Regulation (NDPR).",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="4 August 2026"
      intro="Marksheet processes personal data for schools in order to run the academic cycle. This policy explains what we collect, why we collect it, and how we keep it safe. It applies to the Marksheet web application and public verification portal."
      sections={[
        {
          heading: "Who we are",
          body: "Marksheet is operated for Nigerian secondary schools. A school that subscribes controls its own records, and we act on that school's instructions. Questions about this policy can be sent to support@marksheet.top.",
        },
        {
          heading: "What we collect",
          body: "When a school uses Marksheet we process records they provide: student names, admission numbers, dates of birth, guardians and contact details, staff records, results, and attendance. When you submit a demo or registration request we collect your name, school name, phone and email. When you check a verification code we process only that code and the published summary attached to it.",
        },
        {
          heading: "How we use it",
          body: "We use this data to operate the platform: compute results, publish report cards, generate verification codes, send notices you request, and provide support. We do not sell student data and we do not advertise on the platform.",
        },
        {
          heading: "Legal basis and NDPR",
          body: "We process data to perform our contract with each school, to fulfil legitimate interests such as security and billing, and where required by law. Schools remain data controllers for their own records, and we act as a data processor. We apply the principles of the Nigerian Data Protection Regulation, including lawfulness, minimisation, accuracy, storage limitation and confidentiality.",
        },
        {
          heading: "Guardian consent",
          body: "Schools are expected to capture and record guardian consent for student data, and Marksheet provides a consent field for this purpose. Processing a student's results without a lawful basis is the responsibility of the school that records the data.",
        },
        {
          heading: "Where data is stored",
          body: "Data is stored in secured cloud infrastructure. We encrypt data in transit and at rest, restrict access by role, and log who views or changes sensitive records. We do not move data outside approved regions without notice.",
        },
        {
          heading: "Who can see it",
          body: "Access is role-scoped. Proprietors, principals, teachers, bursars and guardians see only the parts of the platform their role requires. Staff of Marksheet access records only to support you, and that access is logged.",
        },
        {
          heading: "Retention",
          body: "We keep records while a school holds an active licence and for a reasonable period afterwards as required for legal and audit purposes. If your licence lapses nothing is deleted; you keep read access to historical records until renewal.",
        },
        {
          heading: "Your rights",
          body: "You may request access to, correction of, or deletion of personal data we hold, and you may object to processing where a legal basis permits. Schools can request an export of their records at any time. Contact support@marksheet.top to exercise these rights.",
        },
        {
          heading: "Children's data",
          body: "Most of the data we process relates to students who are minors. We do not use student data for marketing, profiling or any purpose beyond operating the school's academic records.",
        },
        {
          heading: "Changes",
          body: "We may update this policy as the platform or law changes. Material changes will be announced in the application and, where relevant, to school administrators before they take effect.",
        },
      ]}
    />
  );
}
