import { headers } from "next/headers";
import { getSchoolByRequestHost } from "@/lib/school-domain";
import { VerifyClient } from "../[shortcode]/verify/client";
import { GenericVerifyClient } from "./generic-verify-client";

export default async function VerifyPage() {
  const host = (await headers()).get("host") ?? "";
  const school = await getSchoolByRequestHost(host);

  if (school) {
    return (
      <VerifyClient
        schoolName={school.name}
        schoolLogo={school.logo}
        schoolMotto={school.motto}
        shortcode={school.shortcode ?? undefined}
        schoolId={school.id}
        initialCode=""
      />
    );
  }

  return <GenericVerifyClient />;
}
