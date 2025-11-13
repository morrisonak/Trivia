import { createFileRoute } from '@tanstack/react-router'
import { drizzle } from 'drizzle-orm/d1'
import { games, gamePlayers, gameQuestions, questions, playerAnswers } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/games/$roomCode/question')({
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
          const { playerId } = await request.json()

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

          if (game.status === 'finished') {
            return Response.json(
              { gameOver: true },
              { status: 200 }
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

          // Get all questions for this game in order
          const gameQuestionList = await db
            .select({
              questionId: gameQuestions.questionId,
              questionOrder: gameQuestions.questionOrder,
              text: questions.text,
              optionA: questions.optionA,
              optionB: questions.optionB,
              optionC: questions.optionC,
              optionD: questions.optionD,
              correctAnswer: questions.correctAnswer,
              commentary: questions.commentary,
            })
            .from(gameQuestions)
            .innerJoin(questions, eq(gameQuestions.questionId, questions.id))
            .where(eq(gameQuestions.gameId, game.id))
            .orderBy(gameQuestions.questionOrder)

          // Count how many questions the player has answered
          const answeredCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(playerAnswers)
            .where(
              sql`${playerAnswers.gameId} = ${game.id} AND ${playerAnswers.playerId} = ${playerId}`
            )

          const questionIndex = answeredCount[0]?.count || 0

          // Check if all questions have been answered
          if (questionIndex >= gameQuestionList.length) {
            return Response.json(
              { gameOver: true },
              { status: 200 }
            )
          }

          // Get the current question
          const currentQuestion = gameQuestionList[questionIndex]

          // Don't send the correct answer or commentary yet
          return Response.json({
            question: {
              id: currentQuestion.questionId,
              text: currentQuestion.text,
              optionA: currentQuestion.optionA,
              optionB: currentQuestion.optionB,
              optionC: currentQuestion.optionC,
              optionD: currentQuestion.optionD,
            },
            questionNumber: questionIndex + 1,
            totalQuestions: gameQuestionList.length,
            playerScore: player.score,
          })
        } catch (error) {
          console.error('Get question error:', error)
          return Response.json(
            { error: 'Failed to get question', details: error },
            { status: 500 }
          )
        }
      },
    },
  },
})