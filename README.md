# Trivia Nights

A real-time multiplayer trivia game where players compete head-to-head with timed questions, speed-based scoring, and live leaderboards. Built for parties, game nights, and casual fun: everyone answers on their phone while an optional "Big Board" shows the game on a TV.

**Live App**: https://trivia-app.jmorrison.workers.dev

## Features

- **Real-time multiplayer**: 2 to 16 players per game, joined with a 4-character room code
- **Big Board display**: put the game on a TV or monitor with large questions, a live "who has answered" tracker, and an animated final leaderboard
- **Scan to join**: the Big Board lobby shows a QR code that opens the join page with the room code filled in
- **Animated cut scenes**: "Get Ready" intro, a wipe-in title card before every question (number, category, and a special "Final Question" card), and a drumroll reveal of the final results
- **Timed questions**: 15 seconds per question with speed-based scoring and streak bonuses
- **Fresh questions**: about 530 questions across 10 categories, and questions from recent games are picked last so groups rarely see repeats
- **Play Again**: the host starts a rematch with the same settings; players and the Big Board follow automatically
- **Resilient games**: game state survives server restarts and deploys, and dropped connections reconnect
- **Mobile-friendly**: touch-optimized layouts, and animations respect the "reduce motion" setting

## How It Works

1. **Host creates a game**: chooses the player limit (4 to 16) and number of questions
2. **Optional Big Board**: on the TV, open `/display` and enter the room code
3. **Players join**: scan the QR code on the Big Board, or enter the room code and a name at `/game/join`
4. **Host starts**: needs at least 2 players
5. **Answer questions**: each question is announced with a cut scene, then players have 15 seconds; the correct answer and commentary are revealed after everyone answers or time runs out
6. **See results**: final rankings with scores and accuracy, then **Play Again** to start a rematch

## Tech Stack

- [TanStack Start](https://tanstack.com/start): full-stack React framework
- [Cloudflare Workers](https://workers.cloudflare.com/): serverless edge runtime
- [Cloudflare D1](https://developers.cloudflare.com/d1/): serverless SQLite database
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/): real-time game state and WebSockets
- [Drizzle ORM](https://orm.drizzle.team/): type-safe database queries
- [Tailwind CSS](https://tailwindcss.com/) v4 + [Shadcn UI](https://ui.shadcn.com/)
- React 19, TanStack Query, Vite, [qrcode.react](https://github.com/zpao/qrcode.react)

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account with Wrangler CLI access

### Installation

```bash
npm install
```

### Database Setup

1. Create the D1 database (if starting fresh):
```bash
npx wrangler d1 create trivia-db
```

2. Apply migrations:
```bash
npx wrangler d1 execute trivia-db --remote --file=./drizzle/0000_*.sql
```

3. Fill the question bank. Either import from [The Trivia API](https://the-trivia-api.com/) (recommended):
```bash
node scripts/import-questions.mjs 500   # writes drizzle/import-questions.sql
npx wrangler d1 execute trivia-db --remote --file=drizzle/import-questions.sql
```
The import is idempotent and skips questions already in the database. Or load the small built-in starter set by hitting the seed endpoint with the dev server running:
```bash
curl -X POST http://localhost:3003/api/seed
```

### Development

```bash
npm run dev
```

The app runs at `http://localhost:3003`. Dev mode uses `--remote`, so it connects to the production D1 database.

### Deploy

```bash
npm run build && npm run deploy
```

## Architecture

The app uses two complementary Cloudflare storage layers:

- **D1**: the question bank, plus a record of every finished game (players, questions, answers, scores)
- **Durable Objects**: one `GameRoom` per room code holds the live game: WebSocket connections, timers, scoring, and orchestration

The lobby polls for player updates. Once the game starts, everything runs over WebSockets through the `GameRoom` Durable Object. Game state is saved to Durable Object storage after every change, and all pacing runs on Durable Object alarms, so a game survives hibernation and deploys. When a game ends, its full record is written to D1.

### Game Phases

```
lobby → starting (Get Ready, 3s) → intro (question cut scene, 2.5s) → question (15s) → results (4s) ─┐
                                      ▲                                                            │
                                      └────────────────────── next question ──────────────────────┘
                                                                         after the last question → finished
```

The answer timer starts only after the intro cut scene, so animations never cost players time.

### Scoring

| Component | Points |
|-----------|--------|
| Correct answer | 100 base |
| Speed bonus | +10 per second remaining |
| Streak bonus | +50 for 3+ correct in a row |

## Project Structure

```
src/
├── routes/                          # File-based routing (TanStack Router)
│   ├── index.tsx                    # Home page
│   ├── game.create.tsx              # Create game form
│   ├── game.join.tsx                # Join by room code (accepts ?code=)
│   ├── game.$roomCode.tsx           # Game lobby
│   ├── game.$roomCode.play.tsx      # Live gameplay (WebSocket)
│   ├── game.$roomCode.results.tsx   # Final results and Play Again
│   ├── display.tsx                  # Big Board setup
│   ├── display_.$roomCode.tsx       # Big Board live display (WebSocket)
│   └── api.*.ts                     # Game API routes
├── components/
│   └── CutScene.tsx                 # Animated transitions between game screens
├── durable-objects/
│   └── GameRoom.ts                  # Real-time game orchestration
├── db/
│   └── schema.ts                    # 5-table schema (questions, games, players, answers)
└── lib/
    ├── scoring.ts                   # Points calculation
    └── room-codes.ts                # Room code generation
scripts/
└── import-questions.mjs             # Question import from The Trivia API
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3003, remote D1) |
| `npm run build` | Production build |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run test` | Run Vitest test suite |
| `npm run typecheck` | Type-check (run a build first so the route tree is fresh) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio GUI |

## Learn More

- [TanStack Start](https://tanstack.com/start)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Drizzle ORM](https://orm.drizzle.team/)
