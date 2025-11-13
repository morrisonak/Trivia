# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack trivia application built with TanStack Start and deployed on Cloudflare Workers. It demonstrates modern web development patterns including SSR, API routes, Cloudflare D1 database integration, and edge deployment.

## Tech Stack

- **Framework**: TanStack Start (full-stack React framework)
- **Runtime**: Cloudflare Workers (serverless edge runtime)
- **Database**: Cloudflare D1 (SQLite-based serverless database)
- **ORM**: Drizzle ORM (type-safe database queries)
- **UI**: React 19 + Tailwind CSS v4 + Shadcn/ui components
- **Forms**: TanStack Form
- **State Management**: TanStack Query
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
npx wrangler d1 execute trivia-db --local --file=drizzle/[migration].sql   # Apply migration locally
npx wrangler d1 execute trivia-db --remote --file=drizzle/[migration].sql  # Apply migration to production
npx wrangler d1 execute trivia-db --local --command="[SQL]"                # Execute SQL locally
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

### Custom Server Entry (CRITICAL)

This project uses a **custom `server-entry.ts`** that wraps TanStack Start's default handler to properly expose Cloudflare bindings. This is essential for accessing D1 and other Cloudflare resources.

```typescript
// server-entry.ts
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const { default: handler } = await import('@tanstack/react-start/server-entry')
    // CRITICAL: Inject env into request so API routes can access it
    request.env = env
    return handler.fetch(request, env, ctx)
  }
}
```

**Configuration**: `wrangler.jsonc` must point to this custom entry:
```json
{
  "main": "./server-entry.ts",
  "d1_databases": [{ "binding": "DB", ... }]
}
```

### Accessing Cloudflare D1 in API Routes

**IMPORTANT**: API routes access D1 via `request.env.DB` (NOT `context.cloudflare.env.DB`):

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { createDb } from '@/db'

export const Route = createFileRoute('/api/todos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Access Cloudflare env from request (injected by server-entry.ts)
        // @ts-expect-error - Cloudflare types
        const env = request.env

        if (!env?.DB) {
          return Response.json(
            { error: 'D1 database binding not found' },
            { status: 500 }
          )
        }

        const db = createDb(env.DB)
        const todos = await db.query.todos.findMany()
        return Response.json(todos)
      },
      POST: async ({ request }) => {
        const { title } = await request.json()
        // @ts-expect-error - Cloudflare types
        const env = request.env
        const db = createDb(env.DB)
        await db.insert(todos).values({ title })
        return Response.json({ success: true })
      }
    }
  }
})
```

### File-Based Routing

Routes are defined in `src/routes/` and automatically detected:
- `src/routes/index.tsx` → `/`
- `src/routes/about.tsx` → `/about`
- `src/routes/demo/drizzle.tsx` → `/demo/drizzle`

API routes follow the same pattern:
- `src/routes/demo/api.d1-todos.ts` → `/demo/api/d1-todos`

The route tree is generated to `src/routeTree.gen.ts` (READ-ONLY).

### Database Access (Cloudflare D1)

D1 is Cloudflare's SQLite-based serverless database.

**1. Via Drizzle ORM** (Recommended):
```typescript
import { createDb } from '@/db'
import { todos } from '@/db/schema'
import { desc } from 'drizzle-orm'

// In API route:
const env = request.env
const db = createDb(env.DB)

// Type-safe queries
const allTodos = await db.query.todos.findMany({
  orderBy: [desc(todos.createdAt)]
})

// Insertions
await db.insert(todos).values({ title: 'New todo' })
```

**2. Direct D1 API**:
```typescript
const env = request.env
const result = await env.DB.prepare('SELECT * FROM todos').all()
```

**Database Schema**: Defined in `src/db/schema.ts` using SQLite types:
```typescript
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`)
})
```

**IMPORTANT**: D1 uses SQLite, not PostgreSQL:
- Use `integer`, `text`, `real`, `blob` (NOT `serial`, `varchar`, `timestamp`)
- Use `CURRENT_TIMESTAMP` (NOT `NOW()`)
- Auto-increment: `{ autoIncrement: true }` (NOT `serial`)

### Development vs Production Database

**Current Setup**:
- Dev mode uses `wrangler dev --remote` which connects to the **production D1 database**
- Both local and production environments share the same data
- This ensures data consistency but means you're working with production data locally

**Alternative Setup** (if user wants separate databases):
1. Create a preview database: `npx wrangler d1 create trivia-db-preview`
2. Update `wrangler.jsonc` `preview_database_id` to use the new database ID
3. Remove `--remote` flag from dev script

### SSR Modes

Routes support different rendering modes:
- Full SSR: Complete server-side rendering
- Streaming SSR: Progressive rendering with suspense
- SPA Mode: Client-side only rendering
- Data-only SSR: Server-side data loading with client rendering

## Project Structure

```
├── src/
│   ├── routes/              # File-based routing (auto-detected)
│   │   ├── __root.tsx       # Root layout (applies to all routes)
│   │   ├── index.tsx        # Home page
│   │   ├── demo/            # Demo routes
│   │   │   ├── drizzle.tsx  # D1 database demo page
│   │   │   ├── api.d1-todos.ts  # API route for todos
│   │   │   ├── form.tsx     # TanStack Form demo
│   │   │   └── punk-songs.tsx   # API fetching demo
│   ├── components/
│   │   ├── Header.tsx       # Main navigation
│   │   └── ui/              # Shadcn/ui components
│   ├── db/
│   │   ├── schema.ts        # Drizzle table definitions (SQLite)
│   │   └── index.ts         # Database client factory
│   ├── lib/
│   │   └── utils.ts         # Utility functions
│   └── router.tsx           # Router configuration
├── drizzle/                 # Database migrations
├── public/                  # Static assets
├── server-entry.ts          # CRITICAL: Custom Cloudflare Workers entry
├── wrangler.jsonc           # Cloudflare Workers config
├── drizzle.config.ts        # Drizzle ORM config
├── vite.config.ts           # Vite config with Cloudflare plugin
└── package.json             # npm scripts
```

## Environment Setup

**Cloudflare D1 Configuration**:
- D1 databases are defined in `wrangler.jsonc` under `d1_databases`
- The binding name `DB` is used to access the database
- Local database stored in `.wrangler/state/v3/d1/` (when using local mode)
- **No environment variables needed** - D1 is accessed via bindings

**Environment Files**:
- `.env` - Local environment variables (mostly empty, D1 uses bindings)
- `.env.example` - Template for environment setup

## Key Files to Know

### Critical Files (DO NOT DELETE):
- `server-entry.ts` - Custom Cloudflare Workers entry that exposes env bindings
- `wrangler.jsonc` - Cloudflare Workers config (includes D1 binding + points to server-entry.ts)
- `src/db/schema.ts` - Database schema definition (SQLite/D1)
- `src/db/index.ts` - Database client factory function
- `drizzle.config.ts` - Database migration configuration for D1
- `vite.config.ts` - Build configuration with Cloudflare plugin

### Auto-Generated Files (READ-ONLY):
- `src/routeTree.gen.ts` - Route tree (regenerated on file changes)

### Configuration Files:
- `components.json` - Shadcn/ui component configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration

## Demo Files

Files in `src/routes/demo/` are examples and can be safely deleted:
- `demo/drizzle.tsx` - D1 database integration demo
- `demo/api.d1-todos.ts` - API route example
- `demo/form.tsx` - TanStack Form demo
- `demo/punk-songs.tsx` - API fetching demo

## Deployment

**Production URL**: https://trivia-app.jmorrison.workers.dev

**Deployment Process**:
1. `npm run build` - Build the application
2. `npm run deploy` - Deploy to Cloudflare Workers

**Cloudflare Workers Details**:
- Worker Name: `trivia-app`
- D1 Database ID: `a72ebdc7-c3a5-4878-9892-89f7ac43aa7a`
- D1 Database Name: `trivia-db`

## Common Issues & Solutions

### Issue: "D1 database binding not found" in API routes
**Solution**: Ensure:
1. `server-entry.ts` exists and injects `request.env = env`
2. `wrangler.jsonc` has `"main": "./server-entry.ts"`
3. API routes access D1 via `request.env.DB` (NOT `context.cloudflare.env.DB`)

### Issue: Local and production data out of sync
**Solution**: Dev mode uses `--remote` flag to connect to production database. To use separate databases:
1. Create preview database: `npx wrangler d1 create trivia-db-preview`
2. Update `preview_database_id` in `wrangler.jsonc`
3. Remove `--remote` from dev script

### Issue: Migration fails with "table already exists"
**Solution**: Check if migration was already applied:
```bash
npx wrangler d1 execute trivia-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Important Notes

- Always run `npm run build` before `npm run deploy`
- Migrations must be applied manually to both local and production databases
- The dev server (`--remote` mode) connects to production D1, so be careful with data modifications
- Console logs may be suppressed in `--remote` mode
- Never add Claude Code attributions in commit messages
