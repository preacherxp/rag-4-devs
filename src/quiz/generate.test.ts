import { describe, expect, test } from "bun:test";
import {
  inspectQuestionQuality,
  normalizeGeneratedQuestions,
  recoverQuizResponse,
  shuffleQuestionOptions,
  validateGeneratedQuestions,
} from "./generate.js";

function makeQuestion(overrides?: Partial<Parameters<typeof inspectQuestionQuality>[0]>) {
  return {
    question: "Which explanation best matches the document?",
    optionA: "A concise but plausible explanation of the mechanism described in the text.",
    optionB: "A related explanation that swaps the cause and effect described in the text.",
    optionC: "An overgeneralized explanation that sounds reasonable but overstates the claim.",
    optionD: "A nearby interpretation that confuses two concepts the document keeps separate.",
    correctAnswer: "A" as const,
    ...overrides,
  };
}

describe("shuffleQuestionOptions", () => {
  test("preserves multiset of options and which text is marked correct", () => {
    const base = {
      question: "q",
      optionA: "a",
      optionB: "b",
      optionC: "c",
      optionD: "d",
      correctAnswer: "B" as const,
    };
    const correctText = base.optionB;
    for (let i = 0; i < 200; i++) {
      const s = shuffleQuestionOptions(base);
      const texts = [s.optionA, s.optionB, s.optionC, s.optionD].slice().sort();
      expect(texts).toEqual(["a", "b", "c", "d"]);
      const chosen =
        s.correctAnswer === "A"
          ? s.optionA
          : s.correctAnswer === "B"
            ? s.optionB
            : s.correctAnswer === "C"
              ? s.optionC
              : s.optionD;
      expect(chosen).toBe(correctText);
    }
  });
});

describe("inspectQuestionQuality", () => {
  test("rejects a correct option that is much longer than distractors", () => {
    const issues = inspectQuestionQuality(
      makeQuestion({
        optionA:
          "A detailed explanation that names the exact causal chain, qualifying conditions, and final consequence described in the document.",
        optionB: "A rough guess.",
        optionC: "A vague summary.",
        optionD: "A broad claim.",
      }),
    );
    expect(issues).toContain("correct option is much longer than distractors");
    expect(issues).toContain(
      "distractors are much shorter or less specific than the correct option",
    );
  });

  test("rejects generic giveaway distractors", () => {
    const issues = inspectQuestionQuality(
      makeQuestion({
        optionB: "All of the above",
      }),
    );
    expect(issues).toContain("one or more distractors are generic giveaway answers");
  });

  test("rejects when the correct option is the only full-sentence style answer", () => {
    const issues = inspectQuestionQuality(
      makeQuestion({
        optionA:
          "The document says the system reduces latency by moving retrieval closer to the source material.",
        optionB: "Lower latency",
        optionC: "Improved indexing",
        optionD: "Reduced variance",
      }),
    );
    expect(issues).toContain("correct option uses a different style than the other options");
  });

  test("rejects duplicate or near-duplicate options", () => {
    const issues = inspectQuestionQuality(
      makeQuestion({
        optionB: "A layered architecture with retrieval, ranking, and answer synthesis.",
        optionC: "A layered architecture with ranking, retrieval, and answer synthesis.",
      }),
    );
    expect(issues).toContain("options contain duplicates or near-duplicates");
  });

  test("accepts balanced plausible options", () => {
    const issues = inspectQuestionQuality(
      makeQuestion({
        optionA: "It improves accuracy by grounding responses in retrieved source passages.",
        optionB: "It improves speed by skipping retrieval and answering only from model memory.",
        optionC:
          "It improves coverage by merging unrelated sources into a single undifferentiated summary.",
        optionD:
          "It improves novelty by prioritizing unsupported guesses over evidence from the text.",
      }),
    );
    expect(issues).toEqual([]);
  });
});

describe("normalizeGeneratedQuestions", () => {
  test("accepts models that return options arrays and correct answer text", () => {
    const questions = normalizeGeneratedQuestions([
      {
        question: "Ktora odpowiedz jest poprawna?",
        options: ["Pierwsza", "Druga", "Trzecia", "Czwarta"],
        correct_answer: "Czwarta",
      },
    ]);

    expect(questions).toEqual([
      {
        question: "Ktora odpowiedz jest poprawna?",
        optionA: "Pierwsza",
        optionB: "Druga",
        optionC: "Trzecia",
        optionD: "Czwarta",
        correctAnswer: "D",
      },
    ]);
  });

  test("accepts numeric correct answer indexes", () => {
    const questions = normalizeGeneratedQuestions([
      {
        question: "Which option is right?",
        options: ["Alpha", "Beta", "Gamma", "Delta"],
        correctAnswer: 2,
      },
    ]);

    expect(questions[0]?.correctAnswer).toBe("C");
  });
});

describe("recoverQuizResponse", () => {
  test("recovers multiple standalone question objects", () => {
    const recovered = recoverQuizResponse(`
      {"question":"Q1","optionA":"A1","optionB":"B1","optionC":"C1","optionD":"D1","correctAnswer":"A"}
      {"question":"Q2","optionA":"A2","optionB":"B2","optionC":"C2","optionD":"D2","correctAnswer":"B"}
    `);

    expect(recovered.questions).toHaveLength(2);
    expect(recovered.questions[0]?.question).toBe("Q1");
    expect(recovered.questions[1]?.correctAnswer).toBe("B");
  });

  test("recovers a single question object without the questions wrapper", () => {
    const recovered = recoverQuizResponse(`
      {"question":"Only one","optionA":"A","optionB":"B","optionC":"C","optionD":"D","correctAnswer":"A"}
    `);

    expect(recovered.questions).toHaveLength(1);
    expect(recovered.questions[0]?.question).toBe("Only one");
  });
});

describe("validateGeneratedQuestions", () => {
  test("reports quiz-level count mismatches and question-level issues", () => {
    const issues = validateGeneratedQuestions(
      [
        makeQuestion({
          optionB: "All of the above",
        }),
      ],
      2,
    );
    expect(issues).toContain("expected 2 questions but received 1");
    expect(issues).toContain("Question 1: one or more distractors are generic giveaway answers");
  });
});
