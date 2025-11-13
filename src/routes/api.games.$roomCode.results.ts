import { createFileRoute } from '@tanstack/react-router'
import { drizzle } from 'drizzle-orm/d1'
import { games, gamePlayers, playerAnswers, gameQuestions } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/games/$roomCode/results')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { roomCode } = params
        // @ts-expect-error - Cloudflare types
        const env = request.env

        if (!env?.DB) {
          return Response.json(
            { error: 'D1 database binding not found' },
            { status: 500 }
          )
        }

        const db = drizzle(env.DB)

        try {
          // Find game by room code
          const [game] = await db
            .select()
            .from(games)
            .where(eq(games.roomCode, roomCode.toUpperCase()))
            .limit(1)

          if (!game) {
            return Response.json(
              { error: 'Game not found' },
              { status: 404 }
            )
          }

          // Get all players with their stats
          const players = await db
            .select({
              id: gamePlayers.id,
              name: gamePlayers.playerName,
              score: gamePlayers.score,
            })
            .from(gamePlayers)
            .where(
              sql`${gamePlayers.gameId} = ${game.id} AND ${gamePlayers.isDisplay} = 0`
            )
            .orderBy(sql`${gamePlayers.score} DESC`)

          // Get total questions count
          const totalQuestionsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(gameQuestions)
            .where(eq(gameQuestions.gameId, game.id))

          const totalQuestions = totalQuestionsResult[0].count

          // Get detailed stats for each player
          const playersWithStats = await Promise.all(
            players.map(async (player) => {
              const answers = await db
                .select({
                  isCorrect: playerAnswers.isCorrect,
                })
                .from(playerAnswers)
                .where(
                  sql`${playerAnswers.gameId} = ${game.id} AND ${playerAnswers.playerId} = ${player.id}`
                )

              const correctAnswers = answers.filter((a) => a.isCorrect).length
              const totalAnswers = answers.length
              const accuracy = totalAnswers > 0
                ? Math.round((correctAnswers / totalAnswers) * 100)
                : 0

              return {
                ...player,
                correctAnswers,
                totalAnswers,
                accuracy,
              }
            })
          )

          // Calculate game statistics
          const scores = playersWithStats.map((p) => p.score)
          const averageScore = scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0
          const highestScore = scores.length > 0
            ? Math.max(...scores)
            : 0

          // Determine winner
          const winner = playersWithStats.length > 0 ? playersWithStats[0] : null

          return Response.json({
            players: playersWithStats,
            winner,
            gameStats: {
              totalQuestions,
              averageScore,
              highestScore,
            },
          })
        } catch (error) {
          console.error('Get results error:', error)
          return Response.json(
            { error: 'Failed to get results', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})