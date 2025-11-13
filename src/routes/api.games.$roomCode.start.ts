import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/games/$roomCode/start')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
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
          const { playerId } = await request.json()

          // Get Durable Object stub for this room
          const id = env.GAME_ROOM.idFromName(roomCode.toUpperCase())
          const stub = env.GAME_ROOM.get(id)

          // Start the game
          const response = await stub.fetch(
            new Request(`https://fake-host/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId }),
            })
          )

          if (!response.ok) {
            const error = await response.json()
            return Response.json(error, { status: response.status })
          }

          const data = await response.json()

          return Response.json(data)
        } catch (error) {
          console.error('Start game error:', error)
          return Response.json(
            { error: 'Failed to start game', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})