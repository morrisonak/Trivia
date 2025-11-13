import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/games/$roomCode/results')({
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
          // Get Durable Object stub
          const id = env.GAME_ROOM.idFromName(roomCode.toUpperCase())
          const stub = env.GAME_ROOM.get(id)

          // Forward request to Durable Object
          const doResponse = await stub.fetch(`http://do/results`, {
            method: 'GET'
          })

          if (!doResponse.ok) {
            return Response.json(
              { error: 'Failed to get results from game room' },
              { status: doResponse.status }
            )
          }

          const results = await doResponse.json()
          return Response.json(results)
        } catch (error) {
          console.error('Get results error:', error)
          return Response.json(
            { error: 'Failed to get results', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
          )
        }
      },
    },
  },
})