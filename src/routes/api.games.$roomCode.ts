import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/games/$roomCode')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { roomCode } = params
        // @ts-expect-error - Cloudflare types
        const env = request.env

        if (!env?.GAME_ROOM) {
          return Response.json(
            { error: 'Durable Object binding not found' },
            { status: 500 }
          )
        }

        try {
          // Get Durable Object stub for this room
          const id = env.GAME_ROOM.idFromName(roomCode.toUpperCase())
          const stub = env.GAME_ROOM.get(id)

          // Get game state
          const response = await stub.fetch(
            new Request(`https://fake-host/state`, {
              method: 'GET',
            })
          )

          if (!response.ok) {
            const error = await response.json()
            return Response.json(error, { status: response.status })
          }

          const data = await response.json()

          return Response.json(data)
        } catch (error) {
          console.error('Get game error:', error)
          return Response.json(
            { error: 'Failed to get game', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})