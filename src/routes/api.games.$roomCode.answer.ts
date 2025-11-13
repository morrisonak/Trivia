import { createFileRoute } from '@tanstack/react-router'
import { drizzle } from 'drizzle-orm/d1'
import { games, gamePlayers, gameQuestions, questions, playerAnswers } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'
import { calculatePoints } from '@/lib/scoring'

export const Route = createFileRoute('/api/games/$roomCode/answer')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
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
          const { playerId, questionId, answer, timeTakenMs } = await request.json()

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

          // Get player
          const [player] = await db
            .select()
            .from(gamePlayers)
            .where(
              sql`${gamePlayers.id} = ${playerId} AND ${gamePlayers.gameId} = ${game.id}`
            )
            .limit(1)

          if (!player) {
            return Response.json(
              { error: 'Player not found in game' },
              { status: 404 }
            )
          }

          // Check if player already answered this question
          const existingAnswer = await db
            .select()
            .from(playerAnswers)
            .where(
              sql`${playerAnswers.gameId} = ${game.id} AND ${playerAnswers.playerId} = ${playerId} AND ${playerAnswers.questionId} = ${questionId}`
            )
            .limit(1)

          if (existingAnswer.length > 0) {
            return Response.json(
              { error: 'Already answered this question' },
              { status: 400 }
            )
          }

          // Get the question
          const [question] = await db
            .select()
            .from(questions)
            .where(eq(questions.id, questionId))
            .limit(1)

          if (!question) {
            return Response.json(
              { error: 'Question not found' },
              { status: 404 }
            )
          }

          // Calculate if answer is correct
          const isCorrect = answer === question.correctAnswer
          let pointsEarned = 0

          if (isCorrect) {
            // Get streak count (consecutive correct answers)
            const recentAnswers = await db
              .select()
              .from(playerAnswers)
              .where(
                sql`${playerAnswers.gameId} = ${game.id} AND ${playerAnswers.playerId} = ${playerId}`
              )
              .orderBy(sql`${playerAnswers.id} DESC`)
              .limit(2) // Get last 2 answers to check streak

            let consecutiveCorrect = 0
            for (const ans of recentAnswers) {
              if (ans.isCorrect) {
                consecutiveCorrect++
              } else {
                break
              }
            }

            // Calculate points
            pointsEarned = calculatePoints(
              timeTakenMs,
              game.timePerQuestion,
              consecutiveCorrect
            )
          }

          // Save answer
          await db.insert(playerAnswers).values({
            gameId: game.id,
            playerId: player.id,
            questionId: question.id,
            answer: answer || null,
            isCorrect: isCorrect ? 1 : 0,
            pointsEarned,
            timeTakenMs,
          })

          // Update player score
          const newScore = player.score + pointsEarned
          await db
            .update(gamePlayers)
            .set({ score: newScore })
            .where(eq(gamePlayers.id, player.id))

          // Check if this was the last question
          const totalQuestions = await db
            .select({ count: sql<number>`count(*)` })
            .from(gameQuestions)
            .where(eq(gameQuestions.gameId, game.id))

          const answeredQuestions = await db
            .select({ count: sql<number>`count(*)` })
            .from(playerAnswers)
            .where(
              sql`${playerAnswers.gameId} = ${game.id} AND ${playerAnswers.playerId} = ${playerId}`
            )

          const isLastQuestion = answeredQuestions[0].count >= totalQuestions[0].count

          // Check if all players have finished
          if (isLastQuestion) {
            const players = await db
              .select()
              .from(gamePlayers)
              .where(
                sql`${gamePlayers.gameId} = ${game.id} AND ${gamePlayers.isDisplay} = 0`
              )

            let allPlayersFinished = true
            for (const p of players) {
              const pAnswers = await db
                .select({ count: sql<number>`count(*)` })
                .from(playerAnswers)
                .where(
                  sql`${playerAnswers.gameId} = ${game.id} AND ${playerAnswers.playerId} = ${p.id}`
                )

              if (pAnswers[0].count < totalQuestions[0].count) {
                allPlayersFinished = false
                break
              }
            }

            if (allPlayersFinished) {
              // Mark game as finished
              await db
                .update(games)
                .set({
                  status: 'finished',
                  endedAt: new Date().toISOString(),
                })
                .where(eq(games.id, game.id))
            }
          }

          return Response.json({
            success: true,
            isCorrect,
            correctAnswer: question.correctAnswer,
            commentary: question.commentary,
            pointsEarned,
            newScore,
            isLastQuestion,
          })
        } catch (error) {
          console.error('Submit answer error:', error)
          return Response.json(
            { error: 'Failed to submit answer', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})