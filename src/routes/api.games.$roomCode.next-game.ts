import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/games/$roomCode/next-game')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const env = request.env

        if (!env?.GAME_ROOM) {
          return Response.json(
            { error: 'Durable Object binding not found' },
            { status: 500 }
          )
        }

        try {
          const { roomCode } = params

          // Get Durable Object stub for this room
          const id = env.GAME_ROOM.idFromName(roomCode.toUpperCase())
          const stub = env.GAME_ROOM.get(id)

          // Check if host has created a new game
          const response = await stub.fetch(
            new Request('https://fake-host/next-game', {
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
          console.error('Get next game error:', error)
          return Response.json(
            { error: 'Failed to get next game', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})
