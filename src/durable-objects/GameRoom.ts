import { DurableObject } from "cloudflare:workers"
import type { Env } from 'cloudflare:workers'
import { calculatePoints } from '../lib/scoring'

const QUESTION_TIME_SECONDS = 15
const RESULTS_DELAY_MS = 4000
const START_DELAY_MS = 1000

interface Player {
  id: string
  name: string
  isHost: boolean
  isDisplay: boolean
  score: number
}

interface Question {
  id: number
  text: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: string
  commentary: string | null
}

interface Answer {
  playerId: string
  questionId: number
  answer: string | null
  isCorrect: boolean
  pointsEarned: number
  timeTakenMs: number
}

// 'starting': brief pause before the first question
// 'question': a question is live and the per-second tick alarm is running
// 'results': answer reveal is showing; next question arrives after a delay
type Phase = 'idle' | 'starting' | 'question' | 'results'

interface GameState {
  roomCode: string
  status: 'lobby' | 'playing' | 'finished'
  players: Map<string, Player>
  maxPlayers: number
  questionCount: number
  currentQuestionIndex: number
  questions: Question[]
  answers: Answer[]
  currentQuestionAnswers: Set<string>
  timer: number | null
  nextGameRoomCode: string | null
  phase: Phase
}

// Storage-friendly shape (Maps/Sets serialized as arrays)
interface PersistedGame extends Omit<GameState, 'players' | 'currentQuestionAnswers'> {
  players: Player[]
  currentQuestionAnswers: string[]
}

function freshState(): GameState {
  return {
    roomCode: '',
    status: 'lobby',
    players: new Map(),
    maxPlayers: 4,
    questionCount: 10,
    currentQuestionIndex: 0,
    questions: [],
    answers: [],
    currentQuestionAnswers: new Set(),
    timer: null,
    nextGameRoomCode: null,
    phase: 'idle',
  }
}

export class GameRoom extends DurableObject<Env> {
  private state: GameState

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.state = freshState()

    // Restore persisted state so games survive hibernation and restarts
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<PersistedGame>('game')
      if (stored) {
        this.state = {
          ...stored,
          players: new Map(stored.players.map((p) => [p.id, p])),
          currentQuestionAnswers: new Set(stored.currentQuestionAnswers),
        }
      }
    })
  }

  private save(): Promise<void> {
    const persisted: PersistedGame = {
      ...this.state,
      players: Array.from(this.state.players.values()),
      currentQuestionAnswers: Array.from(this.state.currentQuestionAnswers),
    }
    return this.ctx.storage.put('game', persisted)
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      this.handleWebSocket(server, url)

      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    }

    const path = url.pathname

    if (path.includes('/init')) {
      return this.handleInit(request)
    }

    if (path.includes('/join')) {
      return this.handleJoin(request)
    }

    if (path.includes('/start')) {
      return this.handleStart(request)
    }

    if (path.includes('/state')) {
      return this.handleGetState()
    }

    if (path.includes('/results')) {
      const results = this.handleGetResults()
      return Response.json(results)
    }

    if (path.includes('/next-game')) {
      return this.handleGetNextGame()
    }

    if (path.includes('/set-next-game')) {
      return this.handleSetNextGame(request)
    }

    return new Response('Not found', { status: 404 })
  }

  private handleWebSocket(ws: WebSocket, url: URL) {
    // Hibernation API: the runtime holds the sockets; we tag each with its playerId
    this.ctx.acceptWebSocket(ws)

    const playerId = url.searchParams.get('playerId')
    if (!playerId || !this.state.players.has(playerId)) {
      ws.close(1008, playerId ? 'Player not found' : 'Missing playerId')
      return
    }

    ws.serializeAttachment({ playerId })
    this.broadcastState()

    // If a question is live, catch the newly connected player up
    if (this.state.phase === 'question' && this.state.currentQuestionIndex < this.state.questions.length) {
      const question = this.state.questions[this.state.currentQuestionIndex]
      ws.send(JSON.stringify({
        type: 'question',
        data: {
          questionNumber: this.state.currentQuestionIndex + 1,
          totalQuestions: this.state.questions.length,
          question: {
            id: question.id,
            text: question.text,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD
          }
        }
      }))

      if (this.state.timer !== null) {
        ws.send(JSON.stringify({
          type: 'timer',
          data: { timeRemaining: this.state.timer }
        }))
      }
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return

    try {
      const data = JSON.parse(message)
      const attachment = ws.deserializeAttachment() as { playerId?: string } | null
      const playerId = attachment?.playerId

      switch (data.type) {
        case 'answer':
          if (playerId) {
            await this.handleAnswer(playerId, data.answer, data.timeTakenMs)
          }
          break
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }))
          break
      }
    } catch (err) {
      console.error('WebSocket message error:', err)
    }
  }

  private async handleInit(request: Request): Promise<Response> {
    const data = await request.json() as { roomCode: string; hostName: string; questionCount: number; maxPlayers?: number }
    const { roomCode, hostName, questionCount, maxPlayers = 4 } = data

    if (!hostName?.trim()) {
      return Response.json({ error: 'Host name is required' }, { status: 400 })
    }

    // A room code can be reused (random collisions, replays): always start clean
    await this.ctx.storage.deleteAlarm()
    this.state = freshState()
    this.state.roomCode = roomCode
    this.state.questionCount = Math.min(Math.max(1, questionCount), 25)
    this.state.maxPlayers = Math.min(Math.max(2, maxPlayers), 10)

    const hostId = crypto.randomUUID()
    this.state.players.set(hostId, {
      id: hostId,
      name: hostName.trim().slice(0, 20),
      isHost: true,
      isDisplay: false,
      score: 0,
    })

    await this.save()
    return Response.json({ playerId: hostId, roomCode })
  }

  private async handleJoin(request: Request): Promise<Response> {
    const data = await request.json() as { playerName: string; isDisplay?: boolean }
    const { playerName, isDisplay = false } = data

    if (!this.state.roomCode) {
      return Response.json({ error: 'Room not found' }, { status: 404 })
    }

    if (!playerName?.trim()) {
      return Response.json({ error: 'Player name is required' }, { status: 400 })
    }

    // Displays can join any time and don't count toward capacity
    if (this.state.status !== 'lobby' && !isDisplay) {
      return Response.json({ error: 'Game already started' }, { status: 400 })
    }

    const actualPlayers = Array.from(this.state.players.values()).filter(p => !p.isDisplay)
    if (!isDisplay && actualPlayers.length >= this.state.maxPlayers) {
      return Response.json({ error: 'Game is full' }, { status: 400 })
    }

    const playerId = crypto.randomUUID()
    this.state.players.set(playerId, {
      id: playerId,
      name: playerName.trim().slice(0, 20),
      isHost: false,
      isDisplay,
      score: 0,
    })

    await this.save()
    this.broadcastState()

    return Response.json({ playerId, roomCode: this.state.roomCode })
  }

  private async handleStart(request: Request): Promise<Response> {
    const data = await request.json() as { playerId: string }
    const { playerId } = data

    const player = this.state.players.get(playerId)
    if (!player?.isHost) {
      return Response.json({ error: 'Only host can start' }, { status: 403 })
    }

    if (this.state.status !== 'lobby') {
      return Response.json({ error: 'Game already started' }, { status: 400 })
    }

    const actualPlayers = Array.from(this.state.players.values()).filter(p => !p.isDisplay)
    if (actualPlayers.length < 2) {
      return Response.json({ error: 'Need at least 2 players' }, { status: 400 })
    }

    try {
      await this.loadQuestions()
    } catch (err) {
      console.error('Failed to load questions:', err)
      return Response.json({ error: 'Failed to load questions' }, { status: 500 })
    }

    this.state.status = 'playing'
    this.state.phase = 'starting'
    await this.save()

    this.broadcast({
      type: 'game_started',
      message: 'Game is starting!'
    })

    await this.ctx.storage.setAlarm(Date.now() + START_DELAY_MS)

    return Response.json({ success: true })
  }

  // All game pacing runs through the alarm so it survives hibernation
  async alarm() {
    switch (this.state.phase) {
      case 'starting':
        await this.nextQuestion()
        break

      case 'question': {
        if (this.state.timer !== null && this.state.timer > 0) {
          this.state.timer--
          this.broadcast({
            type: 'timer',
            data: { timeRemaining: this.state.timer }
          })
        }

        if (this.state.timer === null || this.state.timer <= 0) {
          await this.endQuestion()
        } else {
          await this.save()
          await this.ctx.storage.setAlarm(Date.now() + 1000)
        }
        break
      }

      case 'results':
        this.state.currentQuestionIndex++
        await this.nextQuestion()
        break
    }
  }

  private handleGetState(): Response {
    const players = Array.from(this.state.players.values())
      .filter(p => !p.isDisplay)
      .map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        score: p.score
      }))

    return Response.json({
      roomCode: this.state.roomCode,
      status: this.state.status,
      players,
      maxPlayers: this.state.maxPlayers,
      questionCount: this.state.questionCount
    })
  }

  private async loadQuestions() {
    const result = await this.env.DB.prepare(
      `SELECT id, text, option_a AS optionA, option_b AS optionB, option_c AS optionC, option_d AS optionD,
              correct_answer AS correctAnswer, commentary
       FROM questions ORDER BY RANDOM() LIMIT ?`
    ).bind(this.state.questionCount).all<Question>()

    if (!result.results.length) {
      throw new Error('No questions found in database')
    }

    this.state.questions = result.results
  }

  private async nextQuestion() {
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      await this.endGame()
      return
    }

    const question = this.state.questions[this.state.currentQuestionIndex]
    this.state.currentQuestionAnswers.clear()
    this.state.timer = QUESTION_TIME_SECONDS
    this.state.phase = 'question'
    await this.save()

    // Send question to all players (without correct answer)
    this.broadcast({
      type: 'question',
      data: {
        questionNumber: this.state.currentQuestionIndex + 1,
        totalQuestions: this.state.questions.length,
        question: {
          id: question.id,
          text: question.text,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD
        }
      }
    })

    await this.ctx.storage.setAlarm(Date.now() + 1000)
  }

  private async handleAnswer(playerId: string, answer: string | null, timeTakenMs: number) {
    // Only accept answers while a question is live (not during the results reveal)
    if (this.state.phase !== 'question') return
    if (this.state.currentQuestionAnswers.has(playerId)) return

    const player = this.state.players.get(playerId)
    if (!player || player.isDisplay) return

    const question = this.state.questions[this.state.currentQuestionIndex]
    if (!question) return

    const validAnswer = answer === 'A' || answer === 'B' || answer === 'C' || answer === 'D' ? answer : null
    const clampedTime = Math.min(Math.max(0, Number(timeTakenMs) || 0), QUESTION_TIME_SECONDS * 1000)
    const isCorrect = validAnswer !== null && validAnswer === question.correctAnswer

    this.state.answers.push({
      playerId,
      questionId: question.id,
      answer: validAnswer,
      isCorrect,
      pointsEarned: 0, // set when the question is scored
      timeTakenMs: clampedTime
    })

    this.state.currentQuestionAnswers.add(playerId)

    // Let the Big Board show who has locked in
    this.broadcast({
      type: 'player_answered',
      data: { playerId }
    })

    const actualPlayerCount = Array.from(this.state.players.values()).filter(p => !p.isDisplay).length
    if (this.state.currentQuestionAnswers.size >= actualPlayerCount) {
      await this.endQuestion()
    } else {
      await this.save()
    }
  }

  private consecutiveCorrect(playerId: string): number {
    // Count the player's trailing streak of correct answers (including the latest)
    const playerAnswers = this.state.answers.filter(a => a.playerId === playerId)
    let streak = 0
    for (let i = playerAnswers.length - 1; i >= 0; i--) {
      if (playerAnswers[i].isCorrect) streak++
      else break
    }
    return streak
  }

  private async endQuestion() {
    if (this.state.phase !== 'question') return
    this.state.phase = 'results'
    this.state.timer = null

    const question = this.state.questions[this.state.currentQuestionIndex]

    // Record a timeout (null answer) for everyone who didn't respond,
    // so accuracy stats count every question
    for (const player of this.state.players.values()) {
      if (player.isDisplay) continue
      if (!this.state.currentQuestionAnswers.has(player.id)) {
        this.state.answers.push({
          playerId: player.id,
          questionId: question.id,
          answer: null,
          isCorrect: false,
          pointsEarned: 0,
          timeTakenMs: QUESTION_TIME_SECONDS * 1000
        })
        this.state.currentQuestionAnswers.add(player.id)
      }
    }

    // Score correct answers: base + speed bonus + streak bonus
    const currentAnswers = this.state.answers.filter(a => a.questionId === question.id)
    for (const answerData of currentAnswers) {
      const player = this.state.players.get(answerData.playerId)
      if (!player || !answerData.isCorrect) continue

      const points = calculatePoints(
        answerData.timeTakenMs,
        QUESTION_TIME_SECONDS,
        this.consecutiveCorrect(answerData.playerId)
      )
      answerData.pointsEarned = points
      player.score += points
    }

    const players = Array.from(this.state.players.values())
      .filter(p => !p.isDisplay)
      .map(p => ({
        id: p.id,
        name: p.name,
        score: p.score
      }))

    this.broadcast({
      type: 'results',
      data: {
        correctAnswer: question.correctAnswer,
        commentary: question.commentary,
        players,
        isLastQuestion: this.state.currentQuestionIndex >= this.state.questions.length - 1
      }
    })

    await this.save()
    await this.ctx.storage.setAlarm(Date.now() + RESULTS_DELAY_MS)
  }

  private async endGame() {
    this.state.status = 'finished'
    this.state.phase = 'idle'
    this.state.timer = null
    await this.ctx.storage.deleteAlarm()
    await this.save()

    const players = Array.from(this.state.players.values())
      .filter(p => !p.isDisplay)
      .map(p => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score)

    this.broadcast({
      type: 'game_ended',
      data: { players }
    })

    // Best-effort history record; never let a D1 hiccup break the game
    try {
      await this.persistGameToD1()
    } catch (err) {
      console.error('Failed to persist game to D1:', err)
    }
  }

  private async persistGameToD1() {
    const db = this.env.DB
    const host = Array.from(this.state.players.values()).find(p => p.isHost)

    const gameResult = await db.prepare(
      `INSERT INTO games (room_code, host_player_id, status, max_players, question_count, ended_at)
       VALUES (?, ?, 'finished', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      this.state.roomCode,
      host?.id ?? '',
      this.state.maxPlayers,
      this.state.questions.length
    ).run()
    const gameId = gameResult.meta.last_row_id

    // Map durable-object player UUIDs to D1 row ids
    const playerIdMap = new Map<string, number>()
    for (const p of this.state.players.values()) {
      if (p.isDisplay) continue
      const res = await db.prepare(
        `INSERT INTO game_players (game_id, player_name, connection_id, is_host, is_display, score, status)
         VALUES (?, ?, ?, ?, 0, ?, 'finished')`
      ).bind(gameId, p.name, p.id, p.isHost ? 1 : 0, p.score).run()
      playerIdMap.set(p.id, res.meta.last_row_id)
    }

    const questionStmts = this.state.questions.map((q, i) =>
      db.prepare(
        `INSERT INTO game_questions (game_id, question_id, question_order) VALUES (?, ?, ?)`
      ).bind(gameId, q.id, i)
    )

    const answerStmts = this.state.answers.flatMap((a) => {
      const dbPlayerId = playerIdMap.get(a.playerId)
      if (!dbPlayerId) return []
      return [db.prepare(
        `INSERT INTO player_answers (game_id, player_id, question_id, answer, is_correct, points_earned, time_taken_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(gameId, dbPlayerId, a.questionId, a.answer, a.isCorrect ? 1 : 0, a.pointsEarned, a.timeTakenMs)]
    })

    const stmts = [...questionStmts, ...answerStmts]
    if (stmts.length > 0) {
      await db.batch(stmts)
    }
  }

  private broadcast(message: unknown) {
    const messageStr = JSON.stringify(message)

    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(messageStr)
      } catch {
        // Socket already closed; the runtime cleans it up
      }
    }
  }

  private handleGetResults() {
    const playersWithStats = Array.from(this.state.players.values())
      .filter(player => !player.isDisplay)
      .map(player => {
        const playerAnswers = this.state.answers.filter(a => a.playerId === player.id)
        const correctAnswers = playerAnswers.filter(a => a.isCorrect).length
        const totalAnswers = playerAnswers.length

        return {
          id: player.id,
          name: player.name,
          score: player.score,
          correctAnswers,
          totalAnswers,
          accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0
        }
      }).sort((a, b) => b.score - a.score)

    const scores = playersWithStats.map(p => p.score)
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0
    const winner = playersWithStats.length > 0 ? playersWithStats[0] : null

    return {
      players: playersWithStats,
      winner,
      gameStats: {
        totalQuestions: this.state.questions.length,
        averageScore,
        highestScore
      }
    }
  }

  private broadcastState() {
    const players = Array.from(this.state.players.values())
      .filter(p => !p.isDisplay)
      .map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        score: p.score
      }))

    this.broadcast({
      type: 'state',
      data: {
        status: this.state.status,
        players,
        maxPlayers: this.state.maxPlayers,
        questionCount: this.state.questionCount
      }
    })
  }

  private handleGetNextGame(): Response {
    return Response.json({
      newRoomCode: this.state.nextGameRoomCode
    })
  }

  private async handleSetNextGame(request: Request): Promise<Response> {
    const data = await request.json() as { newRoomCode: string }
    const { newRoomCode } = data

    this.state.nextGameRoomCode = newRoomCode
    await this.save()

    return Response.json({ success: true })
  }
}
