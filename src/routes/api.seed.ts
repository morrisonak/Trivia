import { createFileRoute } from '@tanstack/react-router'
import { seedDatabase } from '@/db/seed'

export const Route = createFileRoute('/api/seed')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // @ts-expect-error - Cloudflare types
        const env = request.env

        if (!env?.DB) {
          return Response.json(
            { error: 'D1 database binding not found' },
            { status: 500 }
          )
        }

        try {
          await seedDatabase(env.DB)
          return Response.json({ success: true, message: 'Database seeded successfully' })
        } catch (error) {
          console.error('Seed error:', error)
          return Response.json(
            { error: 'Failed to seed database', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})