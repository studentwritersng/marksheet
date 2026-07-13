export const NERDC_SUBJECTS: Record<string, string[]> = {
  JSS1: ["English Studies", "Mathematics", "Physical and Health Education", "Christian Religious Studies", "Islamic Studies", "Nigerian History", "Social and Citizenship Studies", "Cultural and Creative Arts", "French", "Intermediate Science", "Digital Technologies", "Business Studies"],
  JSS2: ["English Studies", "Mathematics", "Physical and Health Education", "Christian Religious Studies", "Islamic Studies", "Nigerian History", "Social and Citizenship Studies", "Cultural and Creative Arts", "French", "Intermediate Science", "Digital Technologies", "Business Studies"],
  JSS3: ["English Studies", "Mathematics", "Physical and Health Education", "Christian Religious Studies", "Islamic Studies", "Nigerian History", "Social and Citizenship Studies", "Cultural and Creative Arts", "French", "Intermediate Science", "Digital Technologies", "Business Studies"],
  SSS1: ["English Language", "General Mathematics", "Citizenship and Heritage Studies", "Digital Technologies", "Biology", "Chemistry", "Physics", "Agriculture", "Further Mathematics", "Foods & Nutrition", "Geography", "Technical Drawing", "Nigerian History", "Government", "Christian Religious Studies", "Visual Arts", "Literature in English", "Catering Craft", "Accounting", "Commerce", "Marketing", "Economics"],
  SSS2: ["English Language", "General Mathematics", "Citizenship and Heritage Studies", "Digital Technologies", "Biology", "Chemistry", "Physics", "Agriculture", "Further Mathematics", "Foods & Nutrition", "Geography", "Technical Drawing", "Nigerian History", "Government", "Christian Religious Studies", "Visual Arts", "Literature in English", "Catering Craft", "Accounting", "Commerce", "Marketing", "Economics"],
  SSS3: ["English Language", "General Mathematics", "Citizenship and Heritage Studies", "Digital Technologies", "Biology", "Chemistry", "Physics", "Agriculture", "Further Mathematics", "Foods & Nutrition", "Geography", "Technical Drawing", "Nigerian History", "Government", "Christian Religious Studies", "Visual Arts", "Literature in English", "Catering Craft", "Accounting", "Commerce", "Marketing", "Economics"],
};

export function getAllUniqueSubjects(): string[] {
  const set = new Set<string>();
  for (const list of Object.values(NERDC_SUBJECTS)) {
    for (const s of list) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
