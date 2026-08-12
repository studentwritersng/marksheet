import { describe, it, expect } from "vitest";
import {
  buildAnswerList,
  buildShuffle,
  orderOptions,
  orderQuestions,
  parseSubQuestions,
  remainingFromEndsAt,
  shouldAutoSubmit,
} from "./exam-taking-core";

const q = (id: string, opts: string[] = []) => ({
  id,
  text: id,
  type: "mcq",
  marks: 2,
  mcqOptions: opts.map((x) => ({ id: x, optionText: x })),
});

describe("parseSubQuestions", () => {
  it("returns stem + parts for lettered sub-questions", () => {
    const { stem, parts } = parseSubQuestions("Solve these:\n(a) first\n(b) second");
    expect(stem).toBe("Solve these:");
    expect(parts).toEqual([
      { letter: "a", text: "first" },
      { letter: "b", text: "second" },
    ]);
  });

  it("returns the raw text with no parts when fewer than two lettered lines", () => {
    const { stem, parts } = parseSubQuestions("Just a plain question");
    expect(stem).toBe("Just a plain question");
    expect(parts).toEqual([]);
  });
});

describe("remainingFromEndsAt / shouldAutoSubmit", () => {
  it("computes ceiling seconds to endsAt", () => {
    expect(remainingFromEndsAt(new Date(Date.now() + 60_500).toISOString())).toBe(61);
    expect(remainingFromEndsAt(new Date(Date.now() - 1000).toISOString())).toBe(0);
  });

  it("auto-submits when remaining hits zero or threshold is crossed", () => {
    expect(shouldAutoSubmit(0, null)).toBe(true);
    expect(shouldAutoSubmit(10, new Date(Date.now() - 10_000).toISOString())).toBe(true);
    expect(shouldAutoSubmit(600, null)).toBe(false);
  });
});

describe("buildAnswerList", () => {
  it("flattens essay sub-parts into (letter) text blocks", () => {
    const list = buildAnswerList(
      { "q-1": { essayResponseText: "legacy" } },
      { "q-1": { a: "alpha", b: "beta", c: "  " } },
    );
    expect(list).toEqual([{ questionId: "q-1", essayResponseText: "(a) alpha\n\n(b) beta" }]);
  });

  it("passes through mcq selection", () => {
    const list = buildAnswerList({ "q-1": { mcqSelectedOptionId: "opt-2" } }, {});
    expect(list).toEqual([{ questionId: "q-1", mcqSelectedOptionId: "opt-2" }]);
  });
});

describe("buildShuffle", () => {
  const questions = [
    q("s-1", ["o1", "o2", "o3"]),
    q("g-1", ["a", "b"]),
    q("g-2", ["c", "d"]),
  ].map((x, i) => ({ ...x, questionGroupId: i > 0 ? "grp" : null, groupInternallyShufflable: false }));

  it("returns nulls when shuffle disabled", () => {
    expect(buildShuffle(questions, false)).toEqual({ shuffledQuestionIds: null, shuffledOptionOrder: null });
  });

  it("never splits a group and keeps group internal order locked", () => {
    const { shuffledQuestionIds, shuffledOptionOrder } = buildShuffle(questions, true);
    const sIdx = shuffledQuestionIds!.indexOf("s-1");
    const gIdx = shuffledQuestionIds!.indexOf("g-1");
    const g2Idx = shuffledQuestionIds!.indexOf("g-2");
    expect(shuffledQuestionIds!).toHaveLength(3);
    // g-1 and g-2 stay adjacent (same group item)
    expect(Math.abs(gIdx - g2Idx)).toBe(1);
    expect(sIdx).not.toBe(-1);
    // all ids present
    expect([...shuffledQuestionIds!].sort()).toEqual(["g-1", "g-2", "s-1"].sort());
    // option order shuffled for questions with options (same set, different order)
    expect(shuffledOptionOrder!["s-1"]).toHaveLength(3);
    expect([...shuffledOptionOrder!["s-1"]].sort()).toEqual(["o1", "o2", "o3"]);
  });
});

describe("orderQuestions / orderOptions", () => {
  const questions = [q("b"), q("a"), q("c")];

  it("orders questions by shuffled ids and falls back to original order", () => {
    const ordered = orderQuestions(questions, ["c", "a", "b"]);
    expect(ordered.map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(orderQuestions(questions, null)).toEqual(questions);
    expect(orderQuestions(questions, ["c", "a"])).toEqual(questions); // partial list -> fallback
  });

  it("orders options by shuffled ids and falls back to original order", () => {
    const options = [
      { id: "o1", optionText: "one" },
      { id: "o2", optionText: "two" },
    ];
    const ordered = orderOptions("q", options, { q: ["o2", "o1"] });
    expect(ordered.map((o) => o.id)).toEqual(["o2", "o1"]);
    expect(orderOptions("q", options, null)).toEqual(options);
    // partial order follows the mapped list (mirrors the online getOptions)
    expect(orderOptions("q", options, { q: ["o1"] }).map((o) => o.id)).toEqual(["o1"]);
  });
});
