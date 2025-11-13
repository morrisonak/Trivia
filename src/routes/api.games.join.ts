import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/games/join')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // @ts-expect-error - Cloudflare types
        const env = request.env

        if (!env?.GAME_ROOM) {
          return Response.json(
            { error: 'Durable Object binding not found' },
            { status: 500 }
          )
        }

        try {
          const { roomCode, playerName } = await request.json()

          if (!roomCode || !playerName) {
            return Response.json(
              { error: 'Room code and player name are required' },
              { status: 400 }
            )
          }

          // Get Durable Object stub for this room
          const id = env.GAME_ROOM.idFromName(roomCode.toUpperCase())
          const stub = env.GAME_ROOM.get(id)

          // Join the game room
          const response = await stub.fetch(
            new Request(`https://fake-host/join`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerName }),
            })
          )

          if (!response.ok) {
            const error = await response.json()
            return Response.json(error, { status: response.status })
          }

          const data = await response.json()

          return Response.json({
            success: true,
            game: {
              roomCode: data.roomCode,
              status: 'lobby',
            },
            player: {
              id: data.playerId,
              name: playerName,
              isHost: false,
            },
          })
        } catch (error) {
          console.error('Join game error:', error)
          return Response.json(
            { error: 'Failed to join game', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})