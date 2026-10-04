export const sampleSources = [
  {
    title: "Atlas · Product brief",
    content: `Atlas is a synthetic team knowledge workspace. The pilot serves a product team of twelve people. The first release helps the team collect project notes and find decisions with source-backed answers.

The release scope includes private workspaces, plain-text sources, cited answers, and saved conversations. File parsing, team invitations, external integrations, and automatic actions are outside the first release.

The pilot launch is scheduled for November 12. Maya owns the product checklist; Noah owns the release checklist. Release readiness requires accessibility review and successful restore testing.`,
  },
  {
    title: "Atlas · Architecture decision",
    content: `Atlas uses React and Vite for the interface, Express for the API, and MongoDB for persistent workspace storage. Source retrieval is bounded lexical search over short text excerpts. Embeddings are a future option, not part of this pilot.

Sessions use opaque tokens in HttpOnly cookies. The database stores only a token hash. Each source and conversation is scoped to its owner. The daily AI limit is twenty questions per user. Provider requests time out after twenty-five seconds.

The team rejected a vector database for the pilot because the source set is small and operational simplicity matters. The main retrieval limitation is that synonyms may not match.`,
  },
  {
    title: "Atlas · Research notes",
    content: `Five synthetic research sessions highlighted a common problem: people remember that a decision was made but cannot find the original reasoning. Participants wanted short answers with visible evidence, rather than another generic chatbot.

The research recommendation is to keep citations next to the answer and preserve the original source. Privacy is a priority: only relevant excerpts and the question are sent to the external AI provider after explicit consent. Demo mode never contacts an AI provider.

Research did not establish a pricing model. Revenue projections and production adoption are unknown.`,
  },
];
