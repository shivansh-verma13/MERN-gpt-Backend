import { z } from "zod";

export const ProfileInput = z.object({
  role: z.string().trim().min(3).max(100),
  level: z.enum(["early-career", "mid-level", "senior"]),
  focus: z.enum(["full-stack", "frontend", "backend"]),
  resume: z.string().trim().min(40).max(10000),
  job: z.string().trim().min(40).max(8000),
});
export type Profile = z.infer<typeof ProfileInput>;
const question = z.object({
  text: z.string().trim().min(15).max(900),
  category: z.enum(["technical", "systems", "behavioral"]),
  contextQuote: z.string().max(250),
});
export const PlanOutput = z.object({ questions: z.array(question).length(3) });
export const ReviewOutput = z.object({
  summary: z.string().min(10).max(800),
  strengths: z.array(z.string().min(5).max(250)).max(3),
  improvements: z.array(z.string().min(5).max(250)).min(1).max(3),
  evidence: z
    .array(
      z.object({
        quote: z.string().min(1).max(300),
        observation: z.string().min(5).max(250),
      }),
    )
    .max(3),
  followUp: z.string().min(15).max(600).nullable(),
});
export type Review = z.infer<typeof ReviewOutput>;
export type Question = z.infer<typeof question>;
export type Turn = {
  requestId: string;
  question: string;
  answer: string;
  kind: "primary" | "follow-up";
  review: Review;
  createdAt: string;
  latencyMs: number;
  tokens: number;
};
export type Interview = {
  id: string;
  ownerId: string;
  profile: Profile;
  questions: Question[];
  cursor: number;
  pendingFollowUp: string | null;
  followUpUsed: boolean;
  turns: Turn[];
  status: "active" | "completed";
  version: number;
  createRequestId: string;
  mode: "demo" | "live";
  createdAt: string;
  updatedAt: string;
};
export type ModelRequest = {
  task: "plan" | "review";
  profile: Profile;
  question?: string;
  answer?: string;
  allowFollowUp?: boolean;
};
export type InterviewGenerate = (
  input: ModelRequest,
  schema: z.ZodType,
  signal: AbortSignal,
) => Promise<{ output: unknown; tokens: number }>;

export function validatePlan(raw: unknown, profile: Profile) {
  const plan = PlanOutput.parse(raw);
  if (new Set(plan.questions.map((q) => q.text.toLowerCase())).size !== 3)
    throw new Error("Duplicate questions");
  for (const q of plan.questions)
    if (
      q.contextQuote &&
      !profile.resume.includes(q.contextQuote) &&
      !profile.job.includes(q.contextQuote)
    )
      throw new Error("Invented profile evidence");
  return plan;
}
export function validateReview(raw: unknown, answer: string) {
  const review = ReviewOutput.parse(raw);
  for (const item of review.evidence)
    if (!answer.includes(item.quote))
      throw new Error("Invented answer evidence");
  if (review.strengths.length && !review.evidence.length)
    throw new Error("Strengths require answer evidence");
  return review;
}
export function demoPlan(profile: Profile) {
  const architecture =
    profile.focus === "frontend"
      ? "a slow, interactive dashboard"
      : profile.focus === "backend"
        ? "an API that becomes slow during traffic spikes"
        : "a feature that spans a web UI and an API";
  return {
    questions: [
      {
        text: `Describe a feature you worked on that is relevant to a ${profile.role} role. What did you own, and how did you verify the result?`,
        category: "behavioral" as const,
        contextQuote: "",
      },
      {
        text: `How would you investigate ${architecture}? Walk through measurement, likely causes, and trade-offs.`,
        category: "systems" as const,
        contextQuote: "",
      },
      {
        text: "A user retries a request after a network timeout. How would you avoid duplicate writes and make the interface recover safely?",
        category: "technical" as const,
        contextQuote: "",
      },
    ],
  };
}
export function demoReview(answer: string, allowFollowUp: boolean): Review {
  const words = answer.trim().split(/\s+/).length;
  const measured =
    /\b(test|tested|measure|measured|metric|latency|verify|verified|monitor)\b/i.test(
      answer,
    );
  const tradeoff = /\b(trade.?off|because|however|instead|risk|cost)\b/i.test(
    answer,
  );
  return {
    summary:
      "Local rubric preview, not AI feedback. This checks answer length and explicit mentions of verification and trade-offs; it does not judge technical correctness.",
    strengths:
      words >= 35 ? ["You provided enough detail for a discussion."] : [],
    improvements: [
      ...(words < 35
        ? ["Add a concrete example, your own contribution, and the outcome."]
        : []),
      ...(!measured
        ? [
            "Explain how you would verify the result with tests or measurements.",
          ]
        : []),
      ...(!tradeoff
        ? [
            "State an alternative and explain why you would choose your approach.",
          ]
        : []),
      "Check technical correctness yourself; this demo cannot assess it.",
    ].slice(0, 3),
    evidence:
      words >= 35
        ? [
            {
              quote: answer.slice(0, 180),
              observation:
                "Excerpt from your answer, supporting the presence of a detailed response.",
            },
          ]
        : [],
    followUp: allowFollowUp
      ? "What would you measure or test to check your approach, and what would make you change it?"
      : null,
  };
}
export function activeQuestion(interview: Interview) {
  return (
    interview.pendingFollowUp ??
    interview.questions[interview.cursor]?.text ??
    null
  );
}
export function practiceReport(interview: Interview) {
  return {
    completed: interview.status === "completed",
    answered: interview.turns.length,
    primaryAnswered: interview.cursor,
    strengths: [
      ...new Set(interview.turns.flatMap((t) => t.review.strengths)),
    ].slice(0, 6),
    nextSteps: [
      ...new Set(interview.turns.flatMap((t) => t.review.improvements)),
    ].slice(0, 6),
    disclaimer:
      "Practice feedback only. This is not a hiring decision, validated score, or verification of your qualifications.",
  };
}

export function exportReview(interview: Interview) {
  const literal = (value: string) =>
    value
      .replace(/[\\`*_{}[\]()#+.!|>~-]/g, "\\$&")
      .replace(/</g, "&lt;")
      .replace(/&(?!(?:lt);)/g, "&amp;");
  return (
    [
      "# Interview Lab — practice review",
      literal(interview.profile.role),
      interview.mode === "demo"
        ? "Local demo: template questions and text-rubric feedback; no AI calls."
        : "AI-assisted practice; feedback may be mistaken.",
      practiceReport(interview).disclaimer,
      ...interview.turns.flatMap((t, i) => [
        `\n## ${i + 1}. ${literal(t.question)}`,
        literal(t.answer),
        "### Feedback",
        literal(t.review.summary),
        "Keep: " + t.review.strengths.map(literal).join("; "),
        "Improve: " + t.review.improvements.map(literal).join("; "),
        ...t.review.evidence.map(
          (e) => `> ${literal(e.quote)}\n\n${literal(e.observation)}`,
        ),
      ]),
    ].join("\n\n") + "\n"
  );
}
