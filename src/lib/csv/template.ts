export const studentCsvHeaders = [
  "firstName",
  "middleName",
  "lastName",
  "dateOfBirth",
  "ethnicity",
  "religion",
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
    "John",
    "",
    "Doe",
    "2010-05-15",
    "Igbo",
    "Christianity",
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
