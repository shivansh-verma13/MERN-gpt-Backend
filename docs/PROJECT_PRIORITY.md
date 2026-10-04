# Project priority and repository map

34 public repositories returned after requesting pagination; the first page was complete. Fifteen candidate source trees were inspected. Ranking balances usefulness, portfolio value, engineering depth, and feasible scope. Effort is relative, not a promised timeline.

| Rank / product | Repositories and current behavior | Condition | Potential / AI | Scope, effort, deployment |
|---|---|---|---|---|
| 1 · Briefcase / GPT | MERN-gpt + MERN-gpt-Backend; authenticated generic chat | Broken frontend build, old SDK, unbounded user chats, missing API tests | Private source-grounded questions with citations | Substantial refactor; medium-large; Node/MongoDB/optional OpenAI. **Implemented** |
| 2 · Notes | MERN-NotePadApp-Frontend + NotepadAppBackend; `/notepad` CRUD | CRA, localhost coupling, deeper auth/data audit needed | Semantic search and source-backed summaries | Refactor; medium; Node/MongoDB/AI |
| 3 · VideoMeet | Video-Meet + VideoMeetBackend; WebRTC peer calls/Socket.IO; duplicated local server | Global disconnect broadcast, reconnect/signaling audit needed | Consent-based transcript/action items | Refactor; large; WebSockets/TURN/transcription/persistence |
| 4 · Chat | MERN-ChatApp-FrontEnd + MERN-ChatApp-Backend; people/messages/auth + WebSockets | Delivery, ownership, reconnect need audit | Opt-in conversation summaries/drafting | Refactor; large; persistent WebSocket host/MongoDB |
| 5 · Recipes | RecipeBlogApp API + newer RecipeBlogApp-FrontEnd; RecipeBlogFrontEnd older static version | Duplicate UI versions, localhost coupling | Ingredient-based discovery, validated suggestions | Refactor; medium; Node/MongoDB/AI |
| 6 · Companion | ai-companion; Next/Clerk/Prisma/Postgres and multiple AI/storage services | Broad configuration burden, starter-like README | Memory and evaluation refinement | Audit/refactor; large; several external services/credentials |
| 7 · Jobs | Jobs-Hai; Vue/json-server, alternate App2/App3 | Prototype backend | Explainable matching without invented credentials | Rebuild/refactor; medium-large; persistent API/AI |
| 8 · Weather / tasks | WeatherAct Express/static; ToDo-List Express/EJS/Mongo | Older small projects; ToDo source exposes database credential requiring rotation | Forecast-grounded planning/task assistance only if useful | Rebuild; medium; data/API as needed |
| Maintain · Portfolio | Portfolio active Vite app; PortfolioWebsite1/2 older sites | Portfolio V2 recently shipped | Showcase completed products | Maintenance |

## Exclusions and care

Clinikally, finacPlus, and SuperHumanRace appear assignment-oriented from their source/readmes. starter-express-api is a fork. DrumSet, SimonGame, TinDog, OlympusReplica, ReactHooks, and regression/practice projects are not prioritized as standalone products.

PgVala, PgValaBeta, DashBoardSB, HarjiSoftech, and opt-alpha may involve client/work context: clarify ownership and permitted scope before modification. Names do not prove original authorship or production adoption.

Only the selected paired repositories were modified. Candidate clones were read-only audits. Relationships reflect source/API configuration and history rather than names alone; full audits remain necessary before each next upgrade.
