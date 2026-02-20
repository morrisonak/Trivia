# Trivia Nights

A real-time multiplayer trivia game where players compete head-to-head with timed questions, speed-based scoring, and live leaderboards. Built for parties, game nights, and casual fun.

**Live App**: https://trivia-app.jmorrison.workers.dev

## Features

- **Real-time multiplayer** — Create or join game rooms with 4-character room codes
- **Timed questions** — 15 seconds per question with speed-based scoring
- **Streak bonuses** — Earn extra points for consecutive correct answers
- **Big Board display** — Connect a TV or monitor as a spectator display for parties
- **Play Again** — Seamlessly start a new game with the same group
- **Mobile-friendly** — Touch-optimized interface with responsive layouts

## How It Works

1. **Host creates a game** — Chooses player count and number of questions
2. **Players join** — Enter the room code and a display name
3. **Host starts** — Game begins when everyone is ready
4. **Answer questions** — Timed multiple choice with instant feedback and commentary
5. **See results** — Final rankings with scores, accuracy, and streaks

## Tech Stack

- [TanStack Start](https://tanstack.com/start) — Full-stack React framework
- [Cloudflare Workers](https://workers.cloudflare.com/) — Serverless edge runtime
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — Serverless SQLite database
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) — Real-time game state + WebSockets
- [Drizzle ORM](https://orm.drizzle.team/) — Type-safe database queries
- [Tailwind CSS](https://tailwindcss.com/) v4 + [Shadcn UI](https://ui.shadcn.com/)
- React 19, TanStack Query, Vite

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

3. Seed the question bank:
```bash
# Hit the seed endpoint after starting the dev server
curl -X POST http://localhost:3003/api/seed
```

### Development

```bash
npm run dev
```

The app runs at `http://localhost:3003`. Dev mode uses `--remote` to connect to the production D1 database.

### Deploy

```bash
npm run build && npm run deploy
```

## Architecture

The app uses two complementary Cloudflare storage layers:

- **D1** — Persistent data: questions, game records, player answers, scores
- **Durable Objects** — Real-time ephemeral state: WebSocket connections, timers, live game orchestration

During lobby phase, clients poll for state updates. Once the game starts, all communication switches to WebSockets through the GameRoom Durable Object for instant question delivery, timer sync, and result broadcasting.

### Scoring

| Component | Points |
|-----------|--------|
| Correct answer | 100 base |
| Speed bonus | +10 per second remaining |
| Streak bonus | +50 for 3+ correct in a row |

## Project Structure

```
src/
├── routes/                     # File-based routing (TanStack Router)
│   ├── game.create.tsx         # Create game form
│   ├── game.join.tsx           # Join by room code
│   ├── game.$roomCode.tsx      # Game lobby
│   ├── game.$roomCode.play.tsx # Live gameplay (WebSocket)
│   ├── game.$roomCode.results.tsx # Final results
│   ├── display.$roomCode.tsx   # Big Board display
│   └── api.games.*.ts          # Game API routes
├── durable-objects/
│   └── GameRoom.ts             # Real-time game orchestration
├── db/
│   └── schema.ts               # 5-table schema (questions, games, players, answers)
└── lib/
    ├── scoring.ts              # Points calculation
    └── room-codes.ts           # Room code generation
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3003, remote D1) |
| `npm run build` | Production build |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run test` | Run Vitest test suite |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio GUI |

## Learn More

- [TanStack Start](https://tanstack.com/start)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Drizzle ORM](https://orm.drizzle.team/)
