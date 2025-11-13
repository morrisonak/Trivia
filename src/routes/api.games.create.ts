import { createFileRoute } from '@tanstack/react-router'
import { generateRoomCode } from '@/lib/room-codes'

export const Route = createFileRoute('/api/games/create')({
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
          const { playerName, questionCount = 10, maxPlayers = 4 } = await request.json()

          if (!playerName) {
            return Response.json(
              { error: 'Player name is required' },
              { status: 400 }
            )
          }

          // Generate unique room code
          const roomCode = generateRoomCode()

          // Get Durable Object stub for this room
          const id = env.GAME_ROOM.idFromName(roomCode)
          const stub = env.GAME_ROOM.get(id)

          // Initialize the game room
          const response = await stub.fetch(
            new Request(`https://fake-host/init`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomCode,
                hostName: playerName,
                questionCount,
                maxPlayers,
              }),
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
              questionCount,
            },
            player: {
              id: data.playerId,
              name: playerName,
              isHost: true,
            },
          })
        } catch (error) {
          console.error('Create game error:', error)
          return Response.json(
            { error: 'Failed to create game', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})