import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Refund Policy | Marksheet",
  description: "The circumstances under which Marksheet registration and licence fees can be refunded.",
};

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund Policy"
      updated="4 August 2026"
      intro="Licensing is sales-led and arranged personally with each school. There is no online checkout and no automatic renewal. This policy explains when a refund applies to fees you have already paid."
      sections={[
        {
          heading: "Registration applications",
          body: "Submitting a registration application creates no payment obligation. No fee is charged when you apply. We only request payment once your school's onboarding is confirmed with our team.",
        },
        {
          heading: "Registration fee",
          body: "Where a registration fee has been paid but your school's onboarding is not completed or you decide not to proceed before setup begins, we will refund the full amount within seven working days of your request.",
        },
        {
          heading: "Licence fees",
          body: "Licence fees cover a defined period, such as a term or a month. If the service is unavailable for a prolonged period through our fault, we will extend the licence period or refund the affected portion on request.",
        },
        {
          heading: "Cooling-off period",
          body: "If you paid a licence fee and contact us within seven days before your licence has been activated, we will refund the full amount. Once your licence is active and data has been loaded, fees are generally non-refundable because the period has been consumed.",
        },
        {
          heading: "How to request a refund",
          body: "Email support@marksheet.sch.ng with your school name and the payment reference from your receipt. We will confirm receipt within two working days and process eligible refunds within seven working days.",
        },
        {
          heading: "No automatic renewal",
          body: "Licences do not renew automatically. If your licence lapses, nothing is deleted and you keep read access to historical records. Any renewal is agreed with our team before it takes effect.",
        },
        {
          heading: "Changes",
          body: "We may update this policy as the platform or law changes. The date at the top of this page shows when it was last updated.",
        },
      ]}
    />
  );
}
