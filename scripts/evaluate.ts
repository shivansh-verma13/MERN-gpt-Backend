import assert from "node:assert/strict";
import {
  demoPlan,
  demoReview,
  validatePlan,
  validateReview,
  ProfileInput,
} from "../src/interview.js";
const profile = ProfileInput.parse({
  role: "Backend Engineer",
  level: "early-career",
  focus: "backend",
  resume:
    "Synthetic engineer built an API with authentication and integration tests.",
  job: "Build reliable Node services, validate inputs, and enforce authorization.",
});
const good =
  "I owned the API endpoint and implemented validation because malformed requests must fail early. I tested authorization, measured query latency and compared an indexed query with caching before choosing the simpler database change. No business impact is claimed.";
const plan = demoPlan(profile);
const cases: [string, () => void][] = [
  [
    "valid role plan",
    () => assert.equal(validatePlan(plan, profile).questions.length, 3),
  ],
  [
    "duplicate questions",
    () =>
      assert.throws(() =>
        validatePlan(
          {
            questions: [
              plan.questions[0],
              plan.questions[0],
              plan.questions[2],
            ],
          },
          profile,
        ),
      ),
  ],
  [
    "invented context",
    () =>
      assert.throws(() =>
        validatePlan(
          {
            questions: plan.questions.map((q) => ({
              ...q,
              contextQuote: "I shipped to a million users",
            })),
          },
          profile,
        ),
      ),
  ],
  [
    "exact answer evidence",
    () =>
      assert.ok(validateReview(demoReview(good, true), good).evidence.length),
  ],
  [
    "invented answer evidence",
    () =>
      assert.throws(() =>
        validateReview(
          {
            ...demoReview(good, false),
            evidence: [
              { quote: "fabricated result", observation: "Unsupported claim" },
            ],
          },
          good,
        ),
      ),
  ],
  [
    "unsupported praise",
    () =>
      assert.throws(() =>
        validateReview({ ...demoReview(good, false), evidence: [] }, good),
      ),
  ],
  [
    "weak answer no fabricated strength",
    () => assert.equal(demoReview("I do not know.", false).strengths.length, 0),
  ],
  [
    "follow-up permission",
    () => assert.equal(demoReview(good, false).followUp, null),
  ],
  [
    "focus-sensitive templates",
    () =>
      assert.notEqual(
        plan.questions[1].text,
        demoPlan({ ...profile, focus: "frontend" }).questions[1].text,
      ),
  ],
];
for (const [name, run] of cases) {
  run();
  console.log("PASS " + name);
}
console.log(
  `${cases.length} deterministic policy/rubric cases passed. These do not measure live model quality.`,
);
