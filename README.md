# Trivia App

A full-stack trivia application built with TanStack Start and deployed on Cloudflare Workers.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) - Full-stack React framework
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless edge runtime
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) - Serverless SQLite database
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **State Management**: [TanStack Query](https://tanstack.com/query)
- **Forms**: [TanStack Form](https://tanstack.com/form)

## Project Architecture

### Database Setup

This project uses **Cloudflare D1**, a serverless SQLite database that runs at the edge. The database is accessed via Drizzle ORM for type-safe queries.

#### Key Files:
- `src/db/schema.ts` - Database schema definitions
- `src/db/index.ts` - Database client factory
- `drizzle.config.ts` - Drizzle configuration
- `server-entry.ts` - Custom Cloudflare Workers entry point that exposes D1 bindings

#### Accessing D1 in API Routes:
```typescript
// API routes can access D1 via request.env.DB
export const Route = createFileRoute('/api/todos')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = request.env
        const db = createDb(env.DB)
        // Use db for queries...
      }
    }
  }
})
```

### Custom Server Entry

The project uses a custom `server-entry.ts` that wraps TanStack Start's default handler to properly expose Cloudflare bindings:

```typescript
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const { default: handler } = await import('@tanstack/react-start/server-entry')
    request.env = env // Inject env into request
    return handler.fetch(request, env, ctx)
  }
}
```

This allows API routes to access `request.env.DB` for D1 database access.

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Cloudflare account
- Wrangler CLI (installed as dev dependency)

### Installation

```bash
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. The D1 database is configured via `wrangler.jsonc` - no environment variables needed for local development.

### Database Setup

1. **Create D1 Database** (if not exists):
```bash
npx wrangler d1 create trivia-db
```

2. **Generate Migration**:
```bash
npm run db:generate
```

3. **Apply Migration to Local Database**:
```bash
npx wrangler d1 execute trivia-db --local --file=./drizzle/0000_*.sql
```

4. **Apply Migration to Production Database**:
```bash
npx wrangler d1 execute trivia-db --remote --file=./drizzle/0000_*.sql
```

### Development

Run the development server (connects to production D1 database):

```bash
npm run dev
```

The app will be available at `http://localhost:3003`

**Note**: The dev server uses `wrangler dev --remote` which connects to the production D1 database. This keeps local and production data in sync.

### Building for Production

```bash
npm run build
```

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

The app will be deployed to: `https://trivia-app.jmorrison.workers.dev`

## Database Management

### Generate Schema Changes
```bash
npm run db:generate
```

### Apply Migrations
```bash
# Local database
npx wrangler d1 execute trivia-db --local --file=./drizzle/0000_*.sql

# Production database
npx wrangler d1 execute trivia-db --remote --file=./drizzle/0000_*.sql
```

### Drizzle Studio (Visual Database Editor)
```bash
npm run db:studio
```

### Direct SQL Queries
```bash
# Query local database
npx wrangler d1 execute trivia-db --local --command="SELECT * FROM todos"

# Query production database
npx wrangler d1 execute trivia-db --remote --command="SELECT * FROM todos"
```

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are defined as files in `src/routes/`.

### Adding a Route

Create a new file in `./src/routes/`:
- `src/routes/about.tsx` → `/about`
- `src/routes/demo/drizzle.tsx` → `/demo/drizzle`

### API Routes

API routes follow the same file-based pattern with a special server handler:

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/example')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = request.env
        // Access D1: const db = createDb(env.DB)
        return Response.json({ message: 'Hello' })
      },
      POST: async ({ request }) => {
        const body = await request.json()
        return Response.json({ success: true })
      }
    }
  }
})
```

### Using Links

```tsx
import { Link } from "@tanstack/react-router"

<Link to="/about">About</Link>
```

## Styling

This project uses **Tailwind CSS v4** with the Vite plugin.

### Adding Shadcn Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
```

Components are added to `src/components/ui/`.

## Data Fetching

### Option 1: Route Loaders (Server-Side)

```tsx
export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch("https://api.example.com/people")
    return response.json()
  },
  component: () => {
    const data = Route.useLoaderData()
    return <ul>{data.map(item => <li>{item.name}</li>)}</ul>
  }
})
```

### Option 2: TanStack Query (Client-Side)

```tsx
import { useQuery } from "@tanstack/react-query"

function MyComponent() {
  const { data } = useQuery({
    queryKey: ["todos"],
    queryFn: () => fetch('/api/todos').then(res => res.json())
  })

  return <div>{/* render data */}</div>
}
```

## Testing

```bash
npm run test
```

This project uses [Vitest](https://vitest.dev/) for testing.

## Project Structure

```
├── src/
│   ├── routes/           # File-based routes
│   │   ├── __root.tsx    # Root layout
│   │   ├── index.tsx     # Home page
│   │   └── demo/         # Demo routes
│   ├── db/               # Database schema and client
│   │   ├── schema.ts     # Drizzle schema
│   │   └── index.ts      # DB client factory
│   ├── components/       # React components
│   │   └── ui/           # Shadcn UI components
│   └── lib/              # Utilities
├── drizzle/              # Database migrations
├── public/               # Static assets
├── server-entry.ts       # Custom Cloudflare Workers entry
├── wrangler.jsonc        # Cloudflare Workers config
├── drizzle.config.ts     # Drizzle ORM config
└── vite.config.ts        # Vite config
```

## Key Configuration Files

### wrangler.jsonc
Configures Cloudflare Workers deployment and D1 database bindings:
```json
{
  "main": "./server-entry.ts",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "trivia-db",
      "database_id": "your-database-id"
    }
  ]
}
```

### vite.config.ts
Includes Cloudflare Vite plugin for local development:
```typescript
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    // ...
  ]
})
```

## Demo Files

Files prefixed with `demo` are example implementations and can be safely deleted:
- `src/routes/demo/drizzle.tsx` - D1 database demo
- `src/routes/demo/form.tsx` - TanStack Form demo
- `src/routes/demo/punk-songs.tsx` - API fetching demo

## Production URL

**Live App**: https://trivia-app.jmorrison.workers.dev

## Learn More

- [TanStack Start Documentation](https://tanstack.com/start)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [TanStack Router Documentation](https://tanstack.com/router)
