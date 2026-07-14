export function getMcqCsvTemplate(): string {
  const headers = [
    "type", "text", "marks", "difficulty", "topic", "classLevel",
    "optionA", "optionB", "optionC", "optionD", "correctAnswer",
    "groupTitle", "stimulusType", "stimulusContent",
  ].join(",");
  const row = [
    "mcq",
    "What is the capital of Nigeria?",
    "2",
    "easy",
    "Geography",
    "JSS1",
    "Lagos",
    "Abuja",
    "Kano",
    "Ibadan",
    "B",
    "",
    "",
    "",
  ].join(",");
  return headers + "\n" + row + "\n";
}

export function getEssayCsvTemplate(): string {
  const headers = [
    "type", "text", "marks", "difficulty", "topic", "classLevel",
    "modelAnswer", "rubricPoints",
    "groupTitle", "stimulusType", "stimulusContent",
  ].join(",");
  const row = [
    "essay",
    "Explain the water cycle.",
    "5",
    "medium",
    "Hydrology",
    "JSS2",
    "The water cycle describes how water evaporates, condenses, and precipitates...",
    '[{"description":"Correct explanation","mark":3},{"description":"Examples given","mark":2}]',
    "Water Cycle Group",
    "passage",
    "Read the passage about the water cycle and answer the questions below.",
  ].join(",");
  return headers + "\n" + row + "\n";
}
