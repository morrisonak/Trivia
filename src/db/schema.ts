import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Questions table: Store all trivia questions
export const questions = sqliteTable('questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  optionA: text('option_a').notNull(),
  optionB: text('option_b').notNull(),
  optionC: text('option_c').notNull(),
  optionD: text('option_d').notNull(),
  correctAnswer: text('correct_answer').notNull(), // 'A', 'B', 'C', or 'D'
  category: text('category').default('general'),
  difficulty: integer('difficulty').default(1), // 1-3 scale
  commentary: text('commentary'), // Humorous explanation shown after answer
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
})

// Games table: Track game sessions
export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomCode: text('room_code').unique().notNull(),
  hostPlayerId: text('host_player_id').notNull(),
  status: text('status').default('lobby'), // 'lobby', 'playing', 'finished'
  maxPlayers: integer('max_players').default(4),
  questionCount: integer('question_count').default(10),
  timePerQuestion: integer('time_per_question').default(15),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
})

// Game players: Track participants
export const gamePlayers = sqliteTable('game_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  playerName: text('player_name').notNull(),
  connectionId: text('connection_id').unique(),
  isHost: integer('is_host').default(0), // SQLite uses 0/1 for boolean
  isDisplay: integer('is_display').default(0), // Big Board connection
  score: integer('score').default(0),
  status: text('status').default('connected'),
  joinedAt: text('joined_at').default(sql`(CURRENT_TIMESTAMP)`),
})

// Game questions: Questions selected for each game
export const gameQuestions = sqliteTable('game_questions', {
  gameId: integer('game_id').notNull().references(() => games.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  questionOrder: integer('question_order').notNull(),
  askedAt: text('asked_at'),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.questionId] }),
}))

// Player answers: Track responses and scoring
export const playerAnswers = sqliteTable('player_answers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  playerId: integer('player_id').notNull().references(() => gamePlayers.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  answer: text('answer'), // 'A', 'B', 'C', or 'D'
  isCorrect: integer('is_correct').default(0), // 0 or 1
  pointsEarned: integer('points_earned').default(0),
  timeTakenMs: integer('time_taken_ms'),
  answeredAt: text('answered_at').default(sql`(CURRENT_TIMESTAMP)`),
})

// Type exports for use throughout the application
export type Question = typeof questions.$inferSelect
export type NewQuestion = typeof questions.$inferInsert
export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert
export type GamePlayer = typeof gamePlayers.$inferSelect
export type NewGamePlayer = typeof gamePlayers.$inferInsert
export type GameQuestion = typeof gameQuestions.$inferSelect
export type NewGameQuestion = typeof gameQuestions.$inferInsert
export type PlayerAnswer = typeof playerAnswers.$inferSelect
export type NewPlayerAnswer = typeof playerAnswers.$inferInsert