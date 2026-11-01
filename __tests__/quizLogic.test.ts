import { getBundledWorldQuestions, type WorldQuestion } from "@/data/worldQuiz";
import {
  buildRound,
  MIX_WORLD_COUNT,
  mergeWorldPool,
  pickWithoutRepeats,
  QUESTION_COUNT,
  type SourceQuestion,
  shuffleOptions,
} from "@/games/quiz/logic";
import { forAll } from "./helpers/property";

const WORLD_OPTION = /^[abcd]\d+$/;

const world = (n: number): WorldQuestion[] =>
  Array.from({ length: n }, (_, i) => ({
    answer: i % 4,
    category: "geography",
    difficulty: 1,
    explanation: `fact ${i}`,
    id: `geo-${String(i).padStart(4, "0")}`,
    options: [`a${i}`, `b${i}`, `c${i}`, `d${i}`],
    question: `q${i}?`,
  }));

const aviation: SourceQuestion[] = Array.from({ length: 50 }, (_, i) => ({
  answerIndex: 1,
  key: `aviation-${i + 1}`,
  options: [`w${i}`, `right${i}`, `x${i}`, `y${i}`],
  question: `av${i}?`,
}));

describe("shuffleOptions", () => {
  test("property: the correct option text survives the shuffle", () => {
    forAll("quiz option shuffle keeps the answer", 300, (g) => {
      const options = Array.from(
        { length: 4 },
        (_, i) => `opt-${i}-${g.int(0, 1e6)}`
      );
      const answerIndex = g.int(0, 3);
      const out = shuffleOptions(
        { answerIndex, key: "k", options, question: "?" },
        g.rng
      );
      expect(out.options[out.answerIndex]).toBe(options[answerIndex]);
      expect([...out.options].sort()).toEqual([...options].sort());
    });
  });

  test("real bundled questions keep their answer for every language", () => {
    for (const lang of ["en", "cs", "de", "ja"]) {
      for (const q of getBundledWorldQuestions(lang)) {
        const out = shuffleOptions({
          answerIndex: q.answer,
          key: q.id,
          options: q.options,
          question: q.question,
        });
        expect(out.options[out.answerIndex]).toBe(q.options[q.answer]);
      }
    }
  });

  test("every position is reachable for the correct answer", () => {
    const seen = new Set<number>();
    let seed = 1;
    const rnd = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return seed / 2_147_483_647;
    };
    for (let i = 0; i < 200; i += 1) {
      seen.add(
        shuffleOptions(
          {
            answerIndex: 0,
            key: "k",
            options: ["a", "b", "c", "d"],
            question: "?",
          },
          rnd
        ).answerIndex
      );
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("pickWithoutRepeats", () => {
  test("never repeats until the pool is exhausted, then starts a new cycle", () => {
    const pool = world(40);
    let asked: string[] = [];
    const seen = new Set<string>();
    for (let round = 0; round < 4; round += 1) {
      const res = pickWithoutRepeats(pool, asked, 10);
      expect(res.picked).toHaveLength(10);
      for (const q of res.picked) {
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
      }
      ({ asked } = res);
    }
    expect(seen.size).toBe(40);
    // Exhausted: the 5th round reuses questions and resets the history.
    const next = pickWithoutRepeats(pool, asked, 10);
    expect(next.picked).toHaveLength(10);
    expect(next.asked).toEqual(next.picked.map((q) => q.id));
  });

  test("property: fresh questions are always used first", () => {
    forAll("quiz pick prefers fresh", 300, (g) => {
      const pool = world(g.int(5, 60));
      const askedCount = g.int(0, pool.length);
      const asked = pool.slice(0, askedCount).map((q) => q.id);
      const count = g.int(1, pool.length);
      const res = pickWithoutRepeats(pool, asked, count, g.rng);
      const ids = res.picked.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(count);
      const freshPicked = ids.filter((id) => !asked.includes(id)).length;
      expect(freshPicked).toBe(Math.min(count, pool.length - askedCount));
    });
  });

  test("unknown ids in the history are harmless", () => {
    const res = pickWithoutRepeats(world(5), ["gone-0001"], 5);
    expect(res.picked).toHaveLength(5);
  });
});

describe("buildRound", () => {
  const pool = world(100);

  test("mix = 10 world + 5 aviation; world = 15 world; aviation = 15 aviation", () => {
    const mix = buildRound("mix", pool, aviation, []);
    expect(mix.questions).toHaveLength(QUESTION_COUNT);
    expect(mix.questions.filter((q) => q.key.startsWith("geo-"))).toHaveLength(
      MIX_WORLD_COUNT
    );
    expect(mix.asked).toHaveLength(MIX_WORLD_COUNT);

    const w = buildRound("world", pool, aviation, []);
    expect(w.questions.every((q) => q.key.startsWith("geo-"))).toBe(true);
    expect(w.questions[0].explanation).toBeTruthy();

    const a = buildRound("aviation", pool, aviation, ["geo-0001"]);
    expect(a.questions.every((q) => q.key.startsWith("aviation-"))).toBe(true);
    expect(a.asked).toEqual(["geo-0001"]);
  });

  test("answers stay correct after building a round", () => {
    const round = buildRound("mix", pool, aviation, []);
    for (const q of round.questions) {
      const correct = q.options[q.answerIndex];
      expect(correct.startsWith("right") || WORLD_OPTION.test(correct)).toBe(
        true
      );
      if (q.key.startsWith("geo-")) {
        const src = pool.find((p) => p.id === q.key) as WorldQuestion;
        expect(correct).toBe(src.options[src.answer]);
      } else {
        expect(correct.startsWith("right")).toBe(true);
      }
    }
  });

  test("mergeWorldPool drops duplicate ids (bundled wins)", () => {
    const a = world(3);
    const b = [{ ...a[0], question: "dup" }, ...world(5).slice(3)];
    const merged = mergeWorldPool(a, b);
    expect(merged.map((q) => q.id)).toHaveLength(5);
    expect(merged[0].question).toBe("q0?");
  });
});
