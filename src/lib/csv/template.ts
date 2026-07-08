export const studentCsvHeaders = [
  "admissionNumber",
  "firstName",
  "middleName",
  "lastName",
  "gender",
  "className",
  "department",
  "email",
  "guardianName",
  "guardianPhone",
  "guardianEmail",
  "guardianRelation",
];

export function generateStudentCsvTemplate(): string {
  const header = studentCsvHeaders.join(",");
  const sample = [
    "STU001",
    "John",
    "",
    "Doe",
    "Male",
    "JSS1",
    "",
    "john.doe@student.edu.ng",
    "Jane Doe",
    "08012345678",
    "jane.doe@parent.edu.ng",
    "mother",
  ].join(",");
  return `${header}\n${sample}\n`;
}
