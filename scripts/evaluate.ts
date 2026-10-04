import assert from "node:assert/strict";
import { retrieve } from "../src/retrieval.js";
import { sampleSources } from "../src/demo.js";
import { validateAnswer, answerQuestion } from "../src/ai.js";
const sources = sampleSources.map((s, i) => ({
  ...s,
  id: "s" + i,
  ownerId: "evaluation",
  createdAt: "",
}));
const cases = [
  { question: "When is the pilot launch?", expected: "November 12" },
  {
    question: "What is included in the first release?",
    expected: "private workspaces",
  },
  {
    question: "Why reject a vector database?",
    expected: "operational simplicity",
  },
  { question: "What is the daily AI limit?", expected: "twenty questions" },
  { question: "How are sessions secured?", expected: "HttpOnly" },
  { question: "What is the pricing model?", expected: "did not establish" },
  { question: "quantum gravitational singularities", expected: null },
];
for (const c of cases) {
  const chunks = retrieve(c.question, sources);
  if (c.expected)
    assert.ok(
      chunks.some((v) => v.quote.includes(c.expected!)),
      c.question,
    );
  else assert.equal(chunks.length, 0);
  const result = await answerQuestion(
    c.question,
    chunks,
    "demo",
    undefined,
    new AbortController().signal,
  );
  assert.equal(result.insufficient, !c.expected);
  console.log("PASS " + c.question);
}
assert.throws(() =>
  validateAnswer(
    {
      answer: "Invented",
      insufficient: false,
      citations: [{ chunkId: "external:0", quote: "made up" }],
    },
    retrieve("launch", sources),
  ),
);
console.log("PASS fabricated citation rejected");
console.log(
  "8/8 deterministic retrieval/validation cases passed. Live model quality is NOT evaluated without credentials.",
);
