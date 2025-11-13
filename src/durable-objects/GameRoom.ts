import { DurableObject } from "cloudflare:workers"

interface Player {
  id: string
  name: string
  isHost: boolean
  score: number
  ws: WebSocket | null
}

interface Question {
  id: number
  text: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: string
  commentary: string
}

interface GameState {
  roomCode: string
  status: 'lobby' | 'playing' | 'finished'
  players: Map<string, Player>
  questionCount: number
  currentQuestionIndex: number
  questions: Question[]
  answers: Map<string, { answer: string | null, timeTakenMs: number }>
  timer: number | null
}

export class GameRoom extends DurableObject {
  private state: GameState
  private timerInterval: number | null = null

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env)

    this.state = {
      roomCode: '',
      status: 'lobby',
      players: new Map(),
      questionCount: 10,
      currentQuestionIndex: 0,
      questions: [],
      answers: new Map(),
      timer: null
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)

      await this.handleWebSocket(server, url)

      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    }

    // HTTP endpoints for backwards compatibility
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
      return this.handleGetState(request)
    }

    return new Response('Not found', { status: 404 })
  }

  private async handleWebSocket(ws: WebSocket, url: URL) {
    this.ctx.acceptWebSocket(ws)

    const playerId = url.searchParams.get('playerId')
    if (!playerId) {
      ws.close(1008, 'Missing playerId')
      return
    }

    const player = this.state.players.get(playerId)
    if (player) {
      player.ws = ws
      this.broadcastState()
    }
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return

    try {
      const data = JSON.parse(message)

      switch (data.type) {
        case 'answer':
          this.handleAnswer(data.playerId, data.answer, data.timeTakenMs)
          break
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }))
          break
      }
    } catch (err) {
      console.error('WebSocket message error:', err)
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    // Remove websocket reference from player
    for (const [playerId, player] of this.state.players.entries()) {
      if (player.ws === ws) {
        player.ws = null
      }
    }
  }

  private async handleInit(request: Request): Promise<Response> {
    const { roomCode, hostName, questionCount } = await request.json()

    this.state.roomCode = roomCode
    this.state.questionCount = questionCount

    const hostId = crypto.randomUUID()
    this.state.players.set(hostId, {
      id: hostId,
      name: hostName,
      isHost: true,
      score: 0,
      ws: null
    })

    return Response.json({ playerId: hostId, roomCode })
  }

  private async handleJoin(request: Request): Promise<Response> {
    const { playerName } = await request.json()

    if (this.state.status !== 'lobby') {
      return Response.json({ error: 'Game already started' }, { status: 400 })
    }

    const playerId = crypto.randomUUID()
    this.state.players.set(playerId, {
      id: playerId,
      name: playerName,
      isHost: false,
      score: 0,
      ws: null
    })

    this.broadcastState()

    return Response.json({ playerId, roomCode: this.state.roomCode })
  }

  private async handleStart(request: Request): Promise<Response> {
    const { playerId } = await request.json()

    const player = this.state.players.get(playerId)
    if (!player?.isHost) {
      return Response.json({ error: 'Only host can start' }, { status: 403 })
    }

    if (this.state.players.size < 2) {
      return Response.json({ error: 'Need at least 2 players' }, { status: 400 })
    }

    this.state.status = 'playing'

    // Load questions from D1
    await this.loadQuestions()

    // Broadcast game start to all players
    this.broadcast({
      type: 'game_started',
      message: 'Game is starting!'
    })

    // Send first question
    setTimeout(() => this.nextQuestion(), 1000)

    return Response.json({ success: true })
  }

  private async handleGetState(request: Request): Promise<Response> {
    const players = Array.from(this.state.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      score: p.score
    }))

    return Response.json({
      roomCode: this.state.roomCode,
      status: this.state.status,
      players,
      questionCount: this.state.questionCount
    })
  }

  private async loadQuestions() {
    // In a real implementation, load from D1 database
    // For now, use mock questions
    const mockQuestions: Question[] = []

    for (let i = 0; i < this.state.questionCount; i++) {
      mockQuestions.push({
        id: i + 1,
        text: `Question ${i + 1}: What is the capital of France?`,
        optionA: 'London',
        optionB: 'Berlin',
        optionC: 'Paris',
        optionD: 'Madrid',
        correctAnswer: 'C',
        commentary: 'Paris has been the capital of France since the 12th century.'
      })
    }

    this.state.questions = mockQuestions
  }

  private nextQuestion() {
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      this.endGame()
      return
    }

    const question = this.state.questions[this.state.currentQuestionIndex]
    this.state.answers.clear()
    this.state.timer = 15

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

    // Start timer
    this.startQuestionTimer()
  }

  private startQuestionTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
    }

    this.timerInterval = setInterval(() => {
      if (this.state.timer === null || this.state.timer <= 0) {
        this.endQuestion()
        return
      }

      this.state.timer--

      this.broadcast({
        type: 'timer',
        data: { timeRemaining: this.state.timer }
      })

      // Check if all players have answered
      if (this.state.answers.size === this.state.players.size) {
        this.endQuestion()
      }
    }, 1000)
  }

  private handleAnswer(playerId: string, answer: string | null, timeTakenMs: number) {
    if (this.state.answers.has(playerId)) {
      return // Already answered
    }

    this.state.answers.set(playerId, { answer, timeTakenMs })

    // Check if all players have answered
    if (this.state.answers.size === this.state.players.size) {
      this.endQuestion()
    }
  }

  private endQuestion() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    const question = this.state.questions[this.state.currentQuestionIndex]

    // Calculate scores
    for (const [playerId, answerData] of this.state.answers.entries()) {
      const player = this.state.players.get(playerId)
      if (!player) continue

      if (answerData.answer === question.correctAnswer) {
        // Award points based on speed
        const timeBonus = Math.max(0, 1000 - answerData.timeTakenMs)
        const points = Math.floor(1000 + timeBonus)
        player.score += points
      }
    }

    // Broadcast results
    const players = Array.from(this.state.players.values()).map(p => ({
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

    // Move to next question after delay
    this.state.currentQuestionIndex++
    setTimeout(() => this.nextQuestion(), 4000)
  }

  private endGame() {
    this.state.status = 'finished'

    const players = Array.from(this.state.players.values())
      .map(p => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score)

    this.broadcast({
      type: 'game_ended',
      data: { players }
    })
  }

  private broadcast(message: any) {
    const messageStr = JSON.stringify(message)

    for (const player of this.state.players.values()) {
      if (player.ws && player.ws.readyState === 1) { // OPEN
        player.ws.send(messageStr)
      }
    }
  }

  private broadcastState() {
    const players = Array.from(this.state.players.values()).map(p => ({
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
        questionCount: this.state.questionCount
      }
    })
  }
}
