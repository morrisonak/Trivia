import { createFileRoute } from '@tanstack/react-router'
import { createDb } from '@/db'
import { desc } from 'drizzle-orm'
import { todos } from '@/db/schema'

export const Route = createFileRoute('/demo/api/d1-todos')({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        try {
          // Access Cloudflare env from request (injected by our custom server-entry.ts)
          // @ts-expect-error - Cloudflare types
          const env = request.env

          if (!env?.DB) {
            return Response.json(
              {
                error: 'D1 database binding not found',
                debug: {
                  hasRequestEnv: !!request.env,
                  // @ts-expect-error
                  envKeys: Object.keys(request.env || {})
                }
              },
              { status: 500 }
            )
          }

          const db = createDb(env.DB)

          const allTodos = await db.query.todos.findMany({
            orderBy: [desc(todos.createdAt)],
          })

          return Response.json(allTodos)
        } catch (error) {
          console.error('Error fetching todos:', error)
          return Response.json(
            { error: 'Failed to fetch todos' },
            { status: 500 }
          )
        }
      },
      POST: async ({ request, context }) => {
        try {
          const { title } = await request.json()

          if (!title || typeof title !== 'string') {
            return Response.json(
              { error: 'Title is required' },
              { status: 400 }
            )
          }

          // @ts-expect-error - Cloudflare types
          const env = request.env

          if (!env?.DB) {
            return Response.json(
              { error: 'D1 database binding not found' },
              { status: 500 }
            )
          }

          const db = createDb(env.DB)

          await db.insert(todos).values({ title })

          return Response.json({ success: true }, { status: 201 })
        } catch (error) {
          console.error('Error creating todo:', error)
          return Response.json(
            { error: 'Failed to create todo' },
            { status: 500 }
          )
        }
      },
    },
  },
})
