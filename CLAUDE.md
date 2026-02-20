# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trivia Nights is a real-time multiplayer trivia game built with TanStack Start and deployed on Cloudflare Workers. Players create or join game rooms via 4-character room codes, answer timed questions with speed-based scoring, and compete on a live leaderboard. Supports a "Big Board" display mode for TVs/monitors at parties.

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

# Testing
npm run test            # Run Vitest test suite

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

- **D1 (SQLite)**: Persistent data — questions, game records, player answers, scores
- **Durable Objects (GameRoom)**: Real-time ephemeral state — WebSocket connections, timers, live game orchestration

API routes handle D1 reads/writes. The GameRoom Durable Object manages the live game loop and broadcasts state changes to connected clients via WebSocket.

### Game Flow

```
Create Game → Lobby (polling) → Start → Gameplay (WebSocket) → Results → Play Again
```

1. **Create/Join**: API routes create a Durable Object instance and D1 records
2. **Lobby**: Clients poll `/api/games/$roomCode` every 2s for player list updates
3. **Gameplay**: WebSocket connection to Durable Object for questions, timers, results
4. **Results**: Fetched from Durable Object, displayed with rankings
5. **Play Again**: Host creates new game linked to previous room; other players auto-redirect

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

**Server → Client:** `question`, `timer`, `results`, `game_ended`, `state`, `game_started`
**Client → Server:** `answer` (with `timeTakenMs`), `ping`

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
│   │   ├── display.$roomCode.tsx        # Big Board live display (WebSocket)
│   │   ├── api.games.create.ts          # POST: Create game
│   │   ├── api.games.join.ts            # POST: Join game
│   │   ├── api.games.$roomCode.ts       # GET: Game state
│   │   ├── api.games.$roomCode.start.ts # POST: Start game (host only)
│   │   ├── api.games.$roomCode.question.ts  # GET: Current question
│   │   ├── api.games.$roomCode.answer.ts    # POST: Submit answer
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
│   │   ├── Header.tsx                 # Navigation with slide-out menu
│   │   └── ui/                        # Shadcn/ui components
│   ├── integrations/
│   │   └── tanstack-query/            # React Query providers
│   ├── router.tsx                     # Router configuration
│   └── styles.css                     # Global styles
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

### Issue: Migration fails with "table already exists"
**Solution**: Check if migration was already applied:
```bash
npx wrangler d1 execute trivia-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Important Notes

- Always run `npm run build` before `npm run deploy`
- Dev server (`--remote` mode) connects to production D1 — be careful with data modifications
- Durable Object state is ephemeral; persistent game data lives in D1
- Player session info (playerId, playerName, isHost) is stored in `sessionStorage`
- The Big Board display joins as a player with `isDisplay: true` and doesn't count toward max players
- Never add Claude Code attributions in commit messages
