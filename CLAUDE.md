# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trivia Nights is a real-time multiplayer trivia game built with TanStack Start and deployed on Cloudflare Workers. Players (2 to 16 per game) create or join game rooms via 4-character room codes, answer timed questions with speed-based scoring, and compete on a live leaderboard. Supports a "Big Board" display mode for TVs/monitors at parties, with a scan-to-join QR code and animated cut scenes between questions.

## Tech Stack

- **Framework**: TanStack Start (full-stack React framework)
- **Runtime**: Cloudflare Workers (serverless edge runtime)
- **Database**: Cloudflare D1 (SQLite-based serverless database)
- **Real-time**: Cloudflare Durable Objects + WebSockets (game state & live gameplay)
- **ORM**: Drizzle ORM (type-safe database queries)
- **UI**: React 19 + Tailwind CSS v4 + Shadcn/ui components
- **State Management**: TanStack Query (server state) + sessionStorage (player info)
- **Build Tool**: Vite
- **Package Manager**: npm (package-lock.json present)

## Common Development Commands

```bash
# Development
npm run dev              # Start dev server on port 3003 (uses --remote flag)
                        # Note: Connects to production D1 database for data sync

# Database Management (Cloudflare D1)
npm run db:generate      # Generate Drizzle migrations from schema changes
npm run db:studio       # Open Drizzle Studio GUI for database management

# D1 Database Commands
npx wrangler d1 execute trivia-db --remote --file=drizzle/[migration].sql  # Apply migration to production
npx wrangler d1 execute trivia-db --remote --command="[SQL]"               # Execute SQL in production

# Question Import (The Trivia API -> D1)
node scripts/import-questions.mjs [count]                                  # Generate drizzle/import-questions.sql (default 500)
npx wrangler d1 execute trivia-db --remote --file=drizzle/import-questions.sql  # Apply (idempotent, deduped by question text)

# Testing & Type Checking
npm run test            # Run Vitest test suite
npm run typecheck       # tsc --noEmit (run build first so routeTree.gen.ts is fresh)

# Building & Deployment
npm run build           # Create production build (required before deployment)
npm run serve           # Preview production build locally
npm run deploy          # Deploy to Cloudflare Workers

# Add UI Components
npx shadcn@latest add [component-name]  # Add new Shadcn/ui components
```

## Architecture & Patterns

### Dual Architecture: D1 + Durable Objects

The app uses two complementary Cloudflare storage layers:

- **D1 (SQLite)**: Question bank (seeded via `/api/seed`) and finished-game history (games, players, answers written once at game end)
- **Durable Objects (GameRoom)**: Live game state: WebSocket connections, timers, scoring, orchestration

GameRoom persists its state to Durable Object storage (`ctx.storage`) and restores it in the constructor, so games survive hibernation and deploys. All pacing (question ticks, results delay) runs through DO alarms, not `setInterval`. WebSockets use the hibernation API: sockets are tagged with their playerId via `serializeAttachment`, and broadcasts iterate `ctx.getWebSockets()`. At game start, questions are loaded from D1 in random order, with questions used in the last 15 games (`RECENT_GAMES_TO_AVOID`) sorted last so groups rarely see repeats; at game end, the full game record is written to D1 best-effort.

### Game Flow

```
Create Game → Lobby (polling) → Start → Gameplay (WebSocket) → Results → Play Again
```

1. **Create/Join**: API routes create/join the GameRoom Durable Object. Max players is 2 to 16 (`MAX_PLAYERS_LIMIT`). `/game/join?code=XXXX` prefills the room code (used by the Big Board QR code)
2. **Lobby**: Clients poll `/api/games/$roomCode` every 2s for player list updates
3. **Gameplay**: WebSocket connection to Durable Object for questions, timers, results
4. **Results**: Fetched from Durable Object, displayed with rankings
5. **Play Again**: Host creates new game linked to previous room (`previousRoomCode`); the create API copies the previous game's `maxPlayers`/`questionCount` unless new values are given. Players and the Big Board poll `next-game` and auto-redirect

### Game Phases (GameRoom `phase`, all driven by DO alarms)

```
starting (3s, START_DELAY_MS) → intro (2.5s, INTRO_DELAY_MS) → question (15s ticks) → results (4s, RESULTS_DELAY_MS) → intro ... → finished
```

- `starting`: "Get Ready" cut scene after `game_started`
- `intro`: `question_intro` is broadcast and clients show the question cut scene; the answer timer has NOT started yet, so animations never cost players time
- `question`: question is live, timer ticks once per second; ends early when every non-display player has answered
- `results`: correct answer and scores revealed; then the next `intro`, or `endGame()` after the last question

Clients that connect mid-game are caught up for the current phase (`game_started`, `question_intro`, or `question` + `timer`).

### Custom Server Entry (CRITICAL)

`server-entry.ts` wraps TanStack Start's handler. It does two things:
1. Intercepts WebSocket upgrade requests (`/api/games/[CODE]/ws`) and forwards them to the GameRoom Durable Object
2. Injects Cloudflare `env` into `request.env` so API routes can access D1 and Durable Object bindings

### Accessing Cloudflare Bindings in API Routes

API routes access bindings via `request.env` (injected by `server-entry.ts`):

```typescript
// @ts-expect-error - Cloudflare types
const env = request.env
const db = createDb(env.DB)                    // D1 database
const id = env.GAME_ROOM.idFromName(roomCode)  // Durable Object
const stub = env.GAME_ROOM.get(id)
```

### WebSocket Protocol

Clients connect to `/api/games/[ROOM_CODE]/ws?playerId=[ID]`. Message types:

**Server → Client:** `question_intro`, `question`, `timer`, `results`, `game_ended`, `state`, `game_started`, `player_answered`, `pong`
**Client → Server:** `answer` (with `timeTakenMs`), `ping`

The server identifies the sender from the socket's `serializeAttachment` playerId, not from the message payload. Answers are only accepted while a question is live (`phase === 'question'`); players who don't answer in time get a null answer recorded when the question ends, so accuracy stats always count every question.

### Scoring System (`src/lib/scoring.ts`)

- Base: 100 points per correct answer
- Speed bonus: 10 points per second remaining (of 15s timer)
- Streak bonus: +50 points when 3+ consecutive correct answers

### Room Codes (`src/lib/room-codes.ts`)

4-character alphanumeric codes avoiding ambiguous characters (0/O, 1/I/L). Displayed with spacing: "AB 12".

## Database Schema (Cloudflare D1 / SQLite)

Defined in `src/db/schema.ts`. Five tables:

| Table | Purpose |
|-------|---------|
| `questions` | Trivia question bank (text, 4 options, correctAnswer, category, difficulty, commentary) |
| `games` | Game sessions (roomCode, status: lobby/playing/finished, settings) |
| `game_players` | Player participation (gameId, playerName, isHost, isDisplay, score) |
| `game_questions` | Questions selected for a game (composite PK: gameId + questionId) |
| `player_answers` | Individual responses (answer, isCorrect, pointsEarned, timeTakenMs) |

**IMPORTANT**: D1 uses SQLite, not PostgreSQL:
- Use `integer`, `text`, `real`, `blob` (NOT `serial`, `varchar`, `timestamp`)
- Use `CURRENT_TIMESTAMP` (NOT `NOW()`)
- Booleans are `integer` with 0/1 values

## Project Structure

```
├── src/
│   ├── routes/                          # File-based routing
│   │   ├── __root.tsx                   # Root layout with Header
│   │   ├── index.tsx                    # Home / landing page
│   │   ├── game.create.tsx              # Create game form
│   │   ├── game.join.tsx                # Join game by room code
│   │   ├── game.$roomCode.tsx           # Game lobby (polling)
│   │   ├── game.$roomCode.play.tsx      # Active gameplay (WebSocket)
│   │   ├── game.$roomCode.results.tsx   # Final results & Play Again
│   │   ├── display.tsx                  # Big Board setup page
│   │   ├── display_.$roomCode.tsx       # Big Board live display (WebSocket); `_` un-nests it from display.tsx
│   │   ├── api.games.create.ts          # POST: Create game
│   │   ├── api.games.join.ts            # POST: Join game
│   │   ├── api.games.$roomCode.ts       # GET: Game state
│   │   ├── api.games.$roomCode.start.ts # POST: Start game (host only)
│   │   ├── api.games.$roomCode.results.ts   # GET: Final results
│   │   ├── api.games.$roomCode.next-game.ts # GET: Play Again redirect
│   │   └── api.seed.ts                 # POST: Database seeding
│   ├── durable-objects/
│   │   └── GameRoom.ts                 # Real-time game orchestration (Durable Object)
│   ├── db/
│   │   ├── schema.ts                   # Drizzle table definitions (5 tables)
│   │   ├── index.ts                    # Database client factory
│   │   ├── seed.ts                     # Seed runner
│   │   └── seed-questions.ts           # Question data
│   ├── lib/
│   │   ├── room-codes.ts              # Room code generation & validation
│   │   ├── scoring.ts                 # Points calculation (speed + streak)
│   │   └── utils.ts                   # Tailwind merge utility
│   ├── components/
│   │   ├── CutScene.tsx               # Cut scenes (start / question intro / final) + useCutScene hook
│   │   ├── Header.tsx                 # Navigation with slide-out menu
│   │   └── ui/                        # Shadcn/ui components
│   ├── integrations/
│   │   └── tanstack-query/            # React Query providers
│   ├── router.tsx                     # Router configuration
│   └── styles.css                     # Global styles + transition keyframes (wipe, slam-in, rise-in, pop)
├── drizzle/                           # Database migrations
├── public/                            # Static assets
├── server-entry.ts                    # Custom Cloudflare Workers entry (WebSocket + env injection)
├── wrangler.jsonc                     # Cloudflare Workers config (D1 + Durable Objects)
├── drizzle.config.ts                  # Drizzle ORM config
├── vite.config.ts                     # Vite config with Cloudflare plugin
└── package.json
```

## Key Files to Know

### Critical Files (DO NOT DELETE):
- `server-entry.ts` - Custom Workers entry: WebSocket routing + env injection
- `wrangler.jsonc` - Cloudflare config: D1 binding (`DB`) + Durable Object binding (`GAME_ROOM`)
- `src/durable-objects/GameRoom.ts` - Core game logic: WebSocket handling, timers, game loop
- `src/db/schema.ts` - Database schema (5 tables)
- `src/db/index.ts` - Database client factory
- `src/lib/scoring.ts` - Scoring algorithm
- `src/lib/room-codes.ts` - Room code generation

### Auto-Generated Files (READ-ONLY):
- `src/routeTree.gen.ts` - Route tree (regenerated on file changes)

## Deployment

**Production URL**: https://trivia-app.jmorrison.workers.dev

**Deployment Process**:
1. `npm run build` - Build the application
2. `npm run deploy` - Deploy to Cloudflare Workers

**Cloudflare Workers Details**:
- Worker Name: `trivia-app`
- D1 Database: `trivia-db` (ID: `a72ebdc7-c3a5-4878-9892-89f7ac43aa7a`)
- Durable Object: `GAME_ROOM` class → `GameRoom`

## Common Issues & Solutions

### Issue: "D1 database binding not found" in API routes
**Solution**: Ensure:
1. `server-entry.ts` exists and injects `request.env = env`
2. `wrangler.jsonc` has `"main": "./server-entry.ts"`
3. API routes access D1 via `request.env.DB` (NOT `context.cloudflare.env.DB`)

### Issue: WebSocket connection fails
**Solution**: Ensure:
1. `server-entry.ts` intercepts WebSocket upgrade requests before TanStack handler
2. The URL pattern matches `/api/games/[CODE]/ws`
3. `GAME_ROOM` binding exists in `wrangler.jsonc` with Durable Object config

### Issue: Durable Object not found
**Solution**: Check `wrangler.jsonc` has both the `durable_objects.bindings` and `migrations` sections configured for `GameRoom`.

### Issue: A route like `/display/$roomCode` renders its parent page instead
**Solution**: In TanStack flat file routing, `display.$roomCode.tsx` is a *child* of `display.tsx` and only renders inside the parent's `<Outlet />`. Either add an `<Outlet />` to the parent (as `game.$roomCode.tsx` does) or un-nest the child with a trailing underscore (`display_.$roomCode.tsx`, route id `/display_/$roomCode`, URL unchanged).

### Issue: Migration fails with "table already exists"
**Solution**: Check if migration was already applied:
```bash
npx wrangler d1 execute trivia-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Important Notes

- Always run `npm run build` before `npm run deploy`
- Dev server (`--remote` mode) connects to production D1, so be careful with data modifications
- Durable Object state is persisted to `ctx.storage` (survives hibernation/deploys); finished games are also recorded in D1
- Player session info (playerId, playerName, isHost) is stored in `sessionStorage`
- The Big Board display joins as a player with `isDisplay: true` and doesn't count toward max players. Its layouts get denser for big rooms (lobby grid up to 4 columns, two-column final leaderboard past 8 players)
- Question categories are the 10 from The Trivia API (Science, Geography, Music, etc.); keep `src/db/seed-questions.ts` using the same names
- Never add Claude Code attributions in commit messages
