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

interface Answer {
  playerId: string
  questionId: number
  answer: string | null
  isCorrect: boolean
  timeTakenMs: number
}

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
      maxPlayers: 4,
      questionCount: 10,
      currentQuestionIndex: 0,
      questions: [],
      answers: [],
      currentQuestionAnswers: new Set(),
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

    if (path.includes('/results')) {
      const results = this.handleGetResults()
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      })
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

      // If game is in progress, send current question to newly connected player
      if (this.state.status === 'playing' && this.state.currentQuestionIndex < this.state.questions.length) {
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

        // Also send current timer state
        if (this.state.timer !== null) {
          ws.send(JSON.stringify({
            type: 'timer',
            data: { timeRemaining: this.state.timer }
          }))
        }
      }
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
    const { roomCode, hostName, questionCount, maxPlayers = 4 } = await request.json()

    this.state.roomCode = roomCode
    this.state.questionCount = questionCount
    this.state.maxPlayers = maxPlayers

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
      maxPlayers: this.state.maxPlayers,
      questionCount: this.state.questionCount
    })
  }

  private async loadQuestions() {
    // In a real implementation, load from D1 database
    // For now, use varied mock questions
    const questionBank: Question[] = [
      {
        id: 1,
        text: 'What is the capital of France?',
        optionA: 'London',
        optionB: 'Berlin',
        optionC: 'Paris',
        optionD: 'Madrid',
        correctAnswer: 'C',
        commentary: 'Paris has been the capital of France since the 12th century.'
      },
      {
        id: 2,
        text: 'Which planet is known as the Red Planet?',
        optionA: 'Venus',
        optionB: 'Mars',
        optionC: 'Jupiter',
        optionD: 'Saturn',
        correctAnswer: 'B',
        commentary: 'Mars appears red due to iron oxide (rust) on its surface.'
      },
      {
        id: 3,
        text: 'What is the largest ocean on Earth?',
        optionA: 'Atlantic Ocean',
        optionB: 'Indian Ocean',
        optionC: 'Arctic Ocean',
        optionD: 'Pacific Ocean',
        correctAnswer: 'D',
        commentary: 'The Pacific Ocean covers about 46% of Earth\'s water surface.'
      },
      {
        id: 4,
        text: 'Who painted the Mona Lisa?',
        optionA: 'Vincent van Gogh',
        optionB: 'Pablo Picasso',
        optionC: 'Leonardo da Vinci',
        optionD: 'Michelangelo',
        correctAnswer: 'C',
        commentary: 'Leonardo da Vinci painted the Mona Lisa in the early 16th century.'
      },
      {
        id: 5,
        text: 'What is the smallest country in the world?',
        optionA: 'Monaco',
        optionB: 'San Marino',
        optionC: 'Vatican City',
        optionD: 'Liechtenstein',
        correctAnswer: 'C',
        commentary: 'Vatican City is only 0.44 square kilometers (110 acres).'
      },
      {
        id: 6,
        text: 'Which element has the chemical symbol "Au"?',
        optionA: 'Silver',
        optionB: 'Gold',
        optionC: 'Aluminum',
        optionD: 'Copper',
        correctAnswer: 'B',
        commentary: 'Au comes from the Latin word "aurum" meaning gold.'
      },
      {
        id: 7,
        text: 'What year did the Titanic sink?',
        optionA: '1905',
        optionB: '1912',
        optionC: '1920',
        optionD: '1898',
        correctAnswer: 'B',
        commentary: 'The RMS Titanic sank on April 15, 1912 after hitting an iceberg.'
      },
      {
        id: 8,
        text: 'Which gas do plants absorb from the atmosphere?',
        optionA: 'Oxygen',
        optionB: 'Nitrogen',
        optionC: 'Carbon Dioxide',
        optionD: 'Hydrogen',
        correctAnswer: 'C',
        commentary: 'Plants use carbon dioxide for photosynthesis to produce oxygen.'
      },
      {
        id: 9,
        text: 'What is the tallest mountain in the world?',
        optionA: 'K2',
        optionB: 'Mount Kilimanjaro',
        optionC: 'Mount Everest',
        optionD: 'Denali',
        correctAnswer: 'C',
        commentary: 'Mount Everest stands at 8,849 meters (29,032 feet) above sea level.'
      },
      {
        id: 10,
        text: 'Which programming language was created by Guido van Rossum?',
        optionA: 'JavaScript',
        optionB: 'Python',
        optionC: 'Ruby',
        optionD: 'Java',
        correctAnswer: 'B',
        commentary: 'Guido van Rossum created Python in 1991, named after Monty Python.'
      },
      {
        id: 11,
        text: 'How many continents are there?',
        optionA: '5',
        optionB: '6',
        optionC: '7',
        optionD: '8',
        correctAnswer: 'C',
        commentary: 'There are 7 continents: Africa, Antarctica, Asia, Europe, North America, Australia, and South America.'
      },
      {
        id: 12,
        text: 'What is the speed of light?',
        optionA: '300,000 km/s',
        optionB: '150,000 km/s',
        optionC: '450,000 km/s',
        optionD: '200,000 km/s',
        correctAnswer: 'A',
        commentary: 'Light travels at approximately 299,792 kilometers per second in a vacuum.'
      },
      {
        id: 13,
        text: 'Who wrote "Romeo and Juliet"?',
        optionA: 'Charles Dickens',
        optionB: 'William Shakespeare',
        optionC: 'Jane Austen',
        optionD: 'Mark Twain',
        correctAnswer: 'B',
        commentary: 'William Shakespeare wrote Romeo and Juliet around 1594-1596.'
      },
      {
        id: 14,
        text: 'What is the largest mammal in the world?',
        optionA: 'African Elephant',
        optionB: 'Blue Whale',
        optionC: 'Giraffe',
        optionD: 'Polar Bear',
        correctAnswer: 'B',
        commentary: 'The Blue Whale can grow up to 100 feet long and weigh up to 200 tons.'
      },
      {
        id: 15,
        text: 'In which year did World War II end?',
        optionA: '1943',
        optionB: '1944',
        optionC: '1945',
        optionD: '1946',
        correctAnswer: 'C',
        commentary: 'World War II ended in 1945 with the surrender of Japan in September.'
      },
      {
        id: 16,
        text: 'What is the hardest natural substance on Earth?',
        optionA: 'Gold',
        optionB: 'Iron',
        optionC: 'Diamond',
        optionD: 'Platinum',
        correctAnswer: 'C',
        commentary: 'Diamond is the hardest naturally occurring substance, rating 10 on the Mohs scale.'
      },
      {
        id: 17,
        text: 'How many bones are in the adult human body?',
        optionA: '186',
        optionB: '206',
        optionC: '226',
        optionD: '246',
        correctAnswer: 'B',
        commentary: 'An adult human has 206 bones, while babies are born with about 270.'
      },
      {
        id: 18,
        text: 'What is the currency of Japan?',
        optionA: 'Yuan',
        optionB: 'Won',
        optionC: 'Yen',
        optionD: 'Ringgit',
        correctAnswer: 'C',
        commentary: 'The Japanese Yen (¥) has been the official currency since 1871.'
      },
      {
        id: 19,
        text: 'Who invented the telephone?',
        optionA: 'Thomas Edison',
        optionB: 'Nikola Tesla',
        optionC: 'Alexander Graham Bell',
        optionD: 'Benjamin Franklin',
        correctAnswer: 'C',
        commentary: 'Alexander Graham Bell patented the telephone in 1876.'
      },
      {
        id: 20,
        text: 'What is the chemical formula for water?',
        optionA: 'H2O',
        optionB: 'CO2',
        optionC: 'O2',
        optionD: 'HO2',
        correctAnswer: 'A',
        commentary: 'Water is composed of two hydrogen atoms and one oxygen atom (H2O).'
      },
      {
        id: 21,
        text: 'Which planet is closest to the Sun?',
        optionA: 'Venus',
        optionB: 'Mercury',
        optionC: 'Mars',
        optionD: 'Earth',
        correctAnswer: 'B',
        commentary: 'Mercury orbits the Sun at an average distance of 58 million kilometers.'
      },
      {
        id: 22,
        text: 'What is the largest desert in the world?',
        optionA: 'Sahara',
        optionB: 'Arabian',
        optionC: 'Antarctic',
        optionD: 'Gobi',
        correctAnswer: 'C',
        commentary: 'Antarctica is technically the largest desert at 14 million km², followed by the Sahara.'
      },
      {
        id: 23,
        text: 'Who painted "The Starry Night"?',
        optionA: 'Claude Monet',
        optionB: 'Vincent van Gogh',
        optionC: 'Pablo Picasso',
        optionD: 'Salvador Dalí',
        correctAnswer: 'B',
        commentary: 'Van Gogh painted The Starry Night in 1889 while at an asylum in France.'
      },
      {
        id: 24,
        text: 'What is the powerhouse of the cell?',
        optionA: 'Nucleus',
        optionB: 'Ribosome',
        optionC: 'Mitochondria',
        optionD: 'Chloroplast',
        correctAnswer: 'C',
        commentary: 'Mitochondria produce ATP, the energy currency of cells.'
      },
      {
        id: 25,
        text: 'In which city is the Eiffel Tower located?',
        optionA: 'London',
        optionB: 'Paris',
        optionC: 'Rome',
        optionD: 'Berlin',
        correctAnswer: 'B',
        commentary: 'The Eiffel Tower was built in Paris for the 1889 World\'s Fair.'
      },
      {
        id: 26,
        text: 'What is the boiling point of water at sea level?',
        optionA: '90°C',
        optionB: '100°C',
        optionC: '110°C',
        optionD: '120°C',
        correctAnswer: 'B',
        commentary: 'Water boils at 100°C (212°F) at standard atmospheric pressure.'
      },
      {
        id: 27,
        text: 'Who was the first person to walk on the Moon?',
        optionA: 'Buzz Aldrin',
        optionB: 'Neil Armstrong',
        optionC: 'Yuri Gagarin',
        optionD: 'John Glenn',
        correctAnswer: 'B',
        commentary: 'Neil Armstrong stepped onto the Moon on July 20, 1969.'
      },
      {
        id: 28,
        text: 'What is the largest planet in our solar system?',
        optionA: 'Saturn',
        optionB: 'Neptune',
        optionC: 'Jupiter',
        optionD: 'Uranus',
        correctAnswer: 'C',
        commentary: 'Jupiter is so large that over 1,300 Earths could fit inside it.'
      },
      {
        id: 29,
        text: 'How many sides does a hexagon have?',
        optionA: '5',
        optionB: '6',
        optionC: '7',
        optionD: '8',
        correctAnswer: 'B',
        commentary: 'A hexagon is a polygon with six sides and six angles.'
      },
      {
        id: 30,
        text: 'What is the capital of Australia?',
        optionA: 'Sydney',
        optionB: 'Melbourne',
        optionC: 'Canberra',
        optionD: 'Brisbane',
        correctAnswer: 'C',
        commentary: 'Canberra was chosen as a compromise between Sydney and Melbourne.'
      },
      {
        id: 31,
        text: 'Which organ is responsible for pumping blood?',
        optionA: 'Liver',
        optionB: 'Lungs',
        optionC: 'Heart',
        optionD: 'Kidneys',
        correctAnswer: 'C',
        commentary: 'The heart pumps about 5 liters of blood per minute throughout the body.'
      },
      {
        id: 32,
        text: 'What is the square root of 144?',
        optionA: '10',
        optionB: '11',
        optionC: '12',
        optionD: '13',
        correctAnswer: 'C',
        commentary: '12 × 12 = 144, so the square root of 144 is 12.'
      },
      {
        id: 33,
        text: 'Who developed the theory of relativity?',
        optionA: 'Isaac Newton',
        optionB: 'Albert Einstein',
        optionC: 'Stephen Hawking',
        optionD: 'Galileo Galilei',
        correctAnswer: 'B',
        commentary: 'Einstein published his theory of special relativity in 1905.'
      },
      {
        id: 34,
        text: 'What is the longest river in the world?',
        optionA: 'Amazon',
        optionB: 'Nile',
        optionC: 'Yangtze',
        optionD: 'Mississippi',
        correctAnswer: 'B',
        commentary: 'The Nile River stretches 6,650 km through northeastern Africa.'
      },
      {
        id: 35,
        text: 'In which year did the Berlin Wall fall?',
        optionA: '1987',
        optionB: '1988',
        optionC: '1989',
        optionD: '1990',
        correctAnswer: 'C',
        commentary: 'The Berlin Wall fell on November 9, 1989, reuniting Germany.'
      },
      {
        id: 36,
        text: 'What is the main ingredient in guacamole?',
        optionA: 'Tomato',
        optionB: 'Avocado',
        optionC: 'Pepper',
        optionD: 'Onion',
        correctAnswer: 'B',
        commentary: 'Guacamole is made primarily from mashed avocados.'
      },
      {
        id: 37,
        text: 'How many strings does a standard guitar have?',
        optionA: '4',
        optionB: '5',
        optionC: '6',
        optionD: '7',
        correctAnswer: 'C',
        commentary: 'A standard guitar has 6 strings, tuned E-A-D-G-B-E.'
      },
      {
        id: 38,
        text: 'What is the freezing point of water?',
        optionA: '-10°C',
        optionB: '0°C',
        optionC: '10°C',
        optionD: '32°C',
        correctAnswer: 'B',
        commentary: 'Water freezes at 0°C (32°F) at standard atmospheric pressure.'
      },
      {
        id: 39,
        text: 'Who wrote "1984"?',
        optionA: 'Aldous Huxley',
        optionB: 'George Orwell',
        optionC: 'Ray Bradbury',
        optionD: 'H.G. Wells',
        correctAnswer: 'B',
        commentary: 'George Orwell published his dystopian novel "1984" in 1949.'
      },
      {
        id: 40,
        text: 'What is the chemical symbol for iron?',
        optionA: 'Ir',
        optionB: 'Fe',
        optionC: 'In',
        optionD: 'I',
        correctAnswer: 'B',
        commentary: 'Fe comes from the Latin word "ferrum" meaning iron.'
      },
      {
        id: 41,
        text: 'How many teeth does an adult human typically have?',
        optionA: '28',
        optionB: '30',
        optionC: '32',
        optionD: '34',
        correctAnswer: 'C',
        commentary: 'Adults have 32 teeth, including 4 wisdom teeth.'
      },
      {
        id: 42,
        text: 'What is the capital of Canada?',
        optionA: 'Toronto',
        optionB: 'Vancouver',
        optionC: 'Montreal',
        optionD: 'Ottawa',
        correctAnswer: 'D',
        commentary: 'Ottawa has been the capital of Canada since 1867.'
      },
      {
        id: 43,
        text: 'Which gas makes up most of Earth\'s atmosphere?',
        optionA: 'Oxygen',
        optionB: 'Carbon Dioxide',
        optionC: 'Nitrogen',
        optionD: 'Hydrogen',
        correctAnswer: 'C',
        commentary: 'Nitrogen makes up about 78% of Earth\'s atmosphere.'
      },
      {
        id: 44,
        text: 'Who invented the light bulb?',
        optionA: 'Nikola Tesla',
        optionB: 'Thomas Edison',
        optionC: 'Benjamin Franklin',
        optionD: 'Alexander Graham Bell',
        correctAnswer: 'B',
        commentary: 'Thomas Edison patented the first practical incandescent light bulb in 1879.'
      },
      {
        id: 45,
        text: 'What is the smallest prime number?',
        optionA: '0',
        optionB: '1',
        optionC: '2',
        optionD: '3',
        correctAnswer: 'C',
        commentary: '2 is the smallest and only even prime number.'
      },
      {
        id: 46,
        text: 'In which country is the Great Wall located?',
        optionA: 'Japan',
        optionB: 'China',
        optionC: 'Korea',
        optionD: 'Mongolia',
        correctAnswer: 'B',
        commentary: 'The Great Wall of China stretches over 21,000 kilometers.'
      },
      {
        id: 47,
        text: 'What is the largest land animal?',
        optionA: 'White Rhino',
        optionB: 'Hippopotamus',
        optionC: 'African Elephant',
        optionD: 'Giraffe',
        correctAnswer: 'C',
        commentary: 'African elephants can weigh up to 6,000 kg (13,000 lbs).'
      },
      {
        id: 48,
        text: 'How many players are on a soccer team?',
        optionA: '9',
        optionB: '10',
        optionC: '11',
        optionD: '12',
        correctAnswer: 'C',
        commentary: 'Each soccer team has 11 players on the field, including the goalkeeper.'
      },
      {
        id: 49,
        text: 'What is the capital of Spain?',
        optionA: 'Barcelona',
        optionB: 'Madrid',
        optionC: 'Valencia',
        optionD: 'Seville',
        correctAnswer: 'B',
        commentary: 'Madrid has been the capital of Spain since 1561.'
      },
      {
        id: 50,
        text: 'Who wrote "The Great Gatsby"?',
        optionA: 'Ernest Hemingway',
        optionB: 'F. Scott Fitzgerald',
        optionC: 'John Steinbeck',
        optionD: 'William Faulkner',
        correctAnswer: 'B',
        commentary: 'F. Scott Fitzgerald published The Great Gatsby in 1925.'
      },
      {
        id: 51,
        text: 'What is the largest organ in the human body?',
        optionA: 'Liver',
        optionB: 'Brain',
        optionC: 'Skin',
        optionD: 'Heart',
        correctAnswer: 'C',
        commentary: 'The skin is the largest organ, covering about 2 square meters.'
      },
      {
        id: 52,
        text: 'How many minutes are in a day?',
        optionA: '1,440',
        optionB: '1,340',
        optionC: '1,540',
        optionD: '1,240',
        correctAnswer: 'A',
        commentary: 'There are 24 hours × 60 minutes = 1,440 minutes in a day.'
      },
      {
        id: 53,
        text: 'What is the symbol for potassium?',
        optionA: 'P',
        optionB: 'K',
        optionC: 'Po',
        optionD: 'Pt',
        correctAnswer: 'B',
        commentary: 'K comes from the Latin word "kalium" for potassium.'
      },
      {
        id: 54,
        text: 'In which ocean is the Bermuda Triangle located?',
        optionA: 'Pacific',
        optionB: 'Indian',
        optionC: 'Atlantic',
        optionD: 'Arctic',
        correctAnswer: 'C',
        commentary: 'The Bermuda Triangle is in the western part of the North Atlantic Ocean.'
      },
      {
        id: 55,
        text: 'What year did the first iPhone release?',
        optionA: '2005',
        optionB: '2006',
        optionC: '2007',
        optionD: '2008',
        correctAnswer: 'C',
        commentary: 'Apple released the first iPhone on June 29, 2007.'
      },
      {
        id: 56,
        text: 'How many colors are in a rainbow?',
        optionA: '5',
        optionB: '6',
        optionC: '7',
        optionD: '8',
        correctAnswer: 'C',
        commentary: 'A rainbow has 7 colors: red, orange, yellow, green, blue, indigo, and violet.'
      },
      {
        id: 57,
        text: 'What is the fastest land animal?',
        optionA: 'Lion',
        optionB: 'Cheetah',
        optionC: 'Leopard',
        optionD: 'Gazelle',
        correctAnswer: 'B',
        commentary: 'Cheetahs can reach speeds up to 120 km/h (75 mph).'
      },
      {
        id: 58,
        text: 'Who painted the Sistine Chapel ceiling?',
        optionA: 'Leonardo da Vinci',
        optionB: 'Raphael',
        optionC: 'Michelangelo',
        optionD: 'Donatello',
        correctAnswer: 'C',
        commentary: 'Michelangelo painted the Sistine Chapel ceiling between 1508 and 1512.'
      },
      {
        id: 59,
        text: 'What is the capital of Italy?',
        optionA: 'Venice',
        optionB: 'Milan',
        optionC: 'Rome',
        optionD: 'Florence',
        correctAnswer: 'C',
        commentary: 'Rome has been the capital of Italy since 1871.'
      },
      {
        id: 60,
        text: 'How many legs does a spider have?',
        optionA: '6',
        optionB: '8',
        optionC: '10',
        optionD: '12',
        correctAnswer: 'B',
        commentary: 'All spiders have 8 legs, which distinguishes them from insects.'
      },
      {
        id: 61,
        text: 'What is the currency of the United Kingdom?',
        optionA: 'Euro',
        optionB: 'Dollar',
        optionC: 'Pound Sterling',
        optionD: 'Franc',
        correctAnswer: 'C',
        commentary: 'The British Pound Sterling (£) is one of the oldest currencies still in use.'
      },
      {
        id: 62,
        text: 'Who discovered penicillin?',
        optionA: 'Louis Pasteur',
        optionB: 'Alexander Fleming',
        optionC: 'Marie Curie',
        optionD: 'Jonas Salk',
        correctAnswer: 'B',
        commentary: 'Alexander Fleming discovered penicillin in 1928.'
      },
      {
        id: 63,
        text: 'What is the largest bird in the world?',
        optionA: 'Eagle',
        optionB: 'Ostrich',
        optionC: 'Emu',
        optionD: 'Condor',
        correctAnswer: 'B',
        commentary: 'Ostriches can grow up to 9 feet tall and weigh up to 150 kg.'
      },
      {
        id: 64,
        text: 'How many faces does a cube have?',
        optionA: '4',
        optionB: '5',
        optionC: '6',
        optionD: '8',
        correctAnswer: 'C',
        commentary: 'A cube has 6 square faces, 12 edges, and 8 vertices.'
      },
      {
        id: 65,
        text: 'What is the smallest ocean?',
        optionA: 'Indian',
        optionB: 'Atlantic',
        optionC: 'Arctic',
        optionD: 'Southern',
        correctAnswer: 'C',
        commentary: 'The Arctic Ocean is the smallest, covering about 14 million km².'
      },
      {
        id: 66,
        text: 'In which year did Christopher Columbus discover America?',
        optionA: '1492',
        optionB: '1482',
        optionC: '1502',
        optionD: '1512',
        correctAnswer: 'A',
        commentary: 'Columbus reached the Americas on October 12, 1492.'
      },
      {
        id: 67,
        text: 'What is the atomic number of carbon?',
        optionA: '4',
        optionB: '5',
        optionC: '6',
        optionD: '7',
        correctAnswer: 'C',
        commentary: 'Carbon has 6 protons, giving it an atomic number of 6.'
      },
      {
        id: 68,
        text: 'Who is known as the Father of Computers?',
        optionA: 'Alan Turing',
        optionB: 'Charles Babbage',
        optionC: 'Bill Gates',
        optionD: 'Steve Jobs',
        correctAnswer: 'B',
        commentary: 'Charles Babbage designed the first mechanical computer in the 1830s.'
      },
      {
        id: 69,
        text: 'What is the largest lake in the world?',
        optionA: 'Lake Superior',
        optionB: 'Caspian Sea',
        optionC: 'Lake Victoria',
        optionD: 'Lake Michigan',
        correctAnswer: 'B',
        commentary: 'The Caspian Sea is the world\'s largest lake at 371,000 km².'
      },
      {
        id: 70,
        text: 'How many Olympic rings are there?',
        optionA: '4',
        optionB: '5',
        optionC: '6',
        optionD: '7',
        correctAnswer: 'B',
        commentary: 'The 5 Olympic rings represent the five inhabited continents.'
      },
      {
        id: 71,
        text: 'What is the capital of Egypt?',
        optionA: 'Alexandria',
        optionB: 'Cairo',
        optionC: 'Giza',
        optionD: 'Luxor',
        correctAnswer: 'B',
        commentary: 'Cairo is Egypt\'s capital and the largest city in the Arab world.'
      },
      {
        id: 72,
        text: 'Who wrote "Harry Potter"?',
        optionA: 'J.R.R. Tolkien',
        optionB: 'C.S. Lewis',
        optionC: 'J.K. Rowling',
        optionD: 'Roald Dahl',
        correctAnswer: 'C',
        commentary: 'J.K. Rowling wrote the Harry Potter series between 1997 and 2007.'
      },
      {
        id: 73,
        text: 'What is the main language spoken in Brazil?',
        optionA: 'Spanish',
        optionB: 'Portuguese',
        optionC: 'French',
        optionD: 'English',
        correctAnswer: 'B',
        commentary: 'Portuguese is spoken by over 200 million people in Brazil.'
      },
      {
        id: 74,
        text: 'How many days are in a leap year?',
        optionA: '364',
        optionB: '365',
        optionC: '366',
        optionD: '367',
        correctAnswer: 'C',
        commentary: 'A leap year has 366 days, with February having 29 days.'
      },
      {
        id: 75,
        text: 'What is the symbol for sodium?',
        optionA: 'S',
        optionB: 'Na',
        optionC: 'So',
        optionD: 'N',
        correctAnswer: 'B',
        commentary: 'Na comes from the Latin word "natrium" for sodium.'
      },
      {
        id: 76,
        text: 'Who was the first President of the United States?',
        optionA: 'Thomas Jefferson',
        optionB: 'John Adams',
        optionC: 'George Washington',
        optionD: 'Benjamin Franklin',
        correctAnswer: 'C',
        commentary: 'George Washington served as president from 1789 to 1797.'
      },
      {
        id: 77,
        text: 'What is the largest country by area?',
        optionA: 'Canada',
        optionB: 'China',
        optionC: 'United States',
        optionD: 'Russia',
        correctAnswer: 'D',
        commentary: 'Russia covers over 17 million square kilometers.'
      },
      {
        id: 78,
        text: 'How many keys are on a standard piano?',
        optionA: '76',
        optionB: '82',
        optionC: '88',
        optionD: '92',
        correctAnswer: 'C',
        commentary: 'A standard piano has 88 keys: 52 white and 36 black.'
      },
      {
        id: 79,
        text: 'What is the capital of Germany?',
        optionA: 'Munich',
        optionB: 'Hamburg',
        optionC: 'Berlin',
        optionD: 'Frankfurt',
        correctAnswer: 'C',
        commentary: 'Berlin became the capital of unified Germany in 1990.'
      },
      {
        id: 80,
        text: 'Who invented the World Wide Web?',
        optionA: 'Bill Gates',
        optionB: 'Steve Jobs',
        optionC: 'Tim Berners-Lee',
        optionD: 'Mark Zuckerberg',
        correctAnswer: 'C',
        commentary: 'Tim Berners-Lee invented the World Wide Web in 1989.'
      },
      {
        id: 81,
        text: 'What is the smallest bone in the human body?',
        optionA: 'Stapes',
        optionB: 'Femur',
        optionC: 'Radius',
        optionD: 'Fibula',
        correctAnswer: 'A',
        commentary: 'The stapes in the ear is only about 3mm long.'
      },
      {
        id: 82,
        text: 'How many zeros are in one million?',
        optionA: '5',
        optionB: '6',
        optionC: '7',
        optionD: '8',
        correctAnswer: 'B',
        commentary: 'One million is written as 1,000,000 (six zeros).'
      },
      {
        id: 83,
        text: 'What is the capital of Japan?',
        optionA: 'Osaka',
        optionB: 'Kyoto',
        optionC: 'Tokyo',
        optionD: 'Hiroshima',
        correctAnswer: 'C',
        commentary: 'Tokyo has been Japan\'s capital since 1868.'
      },
      {
        id: 84,
        text: 'Who painted "The Last Supper"?',
        optionA: 'Michelangelo',
        optionB: 'Leonardo da Vinci',
        optionC: 'Raphael',
        optionD: 'Caravaggio',
        correctAnswer: 'B',
        commentary: 'Leonardo da Vinci painted The Last Supper between 1495 and 1498.'
      },
      {
        id: 85,
        text: 'What is the tallest building in the world?',
        optionA: 'Shanghai Tower',
        optionB: 'Burj Khalifa',
        optionC: 'Empire State Building',
        optionD: 'One World Trade Center',
        correctAnswer: 'B',
        commentary: 'Burj Khalifa in Dubai stands at 828 meters (2,717 feet).'
      },
      {
        id: 86,
        text: 'How many stars are on the American flag?',
        optionA: '48',
        optionB: '49',
        optionC: '50',
        optionD: '51',
        correctAnswer: 'C',
        commentary: 'The 50 stars represent the 50 states of the United States.'
      },
      {
        id: 87,
        text: 'What is the chemical symbol for silver?',
        optionA: 'Si',
        optionB: 'Ag',
        optionC: 'Au',
        optionD: 'S',
        correctAnswer: 'B',
        commentary: 'Ag comes from the Latin word "argentum" for silver.'
      },
      {
        id: 88,
        text: 'In which city is the Colosseum located?',
        optionA: 'Athens',
        optionB: 'Rome',
        optionC: 'Istanbul',
        optionD: 'Cairo',
        correctAnswer: 'B',
        commentary: 'The Colosseum in Rome was built around 70-80 AD.'
      },
      {
        id: 89,
        text: 'What is the largest species of shark?',
        optionA: 'Great White Shark',
        optionB: 'Tiger Shark',
        optionC: 'Whale Shark',
        optionD: 'Hammerhead Shark',
        correctAnswer: 'C',
        commentary: 'Whale sharks can grow up to 18 meters (59 feet) long.'
      },
      {
        id: 90,
        text: 'How many sides does a pentagon have?',
        optionA: '4',
        optionB: '5',
        optionC: '6',
        optionD: '7',
        correctAnswer: 'B',
        commentary: 'A pentagon is a polygon with five sides and five angles.'
      },
      {
        id: 91,
        text: 'What is the currency of China?',
        optionA: 'Yen',
        optionB: 'Won',
        optionC: 'Yuan',
        optionD: 'Ringgit',
        correctAnswer: 'C',
        commentary: 'The Chinese Yuan (¥) is also known as the Renminbi.'
      },
      {
        id: 92,
        text: 'Who discovered gravity?',
        optionA: 'Galileo Galilei',
        optionB: 'Isaac Newton',
        optionC: 'Albert Einstein',
        optionD: 'Johannes Kepler',
        correctAnswer: 'B',
        commentary: 'Isaac Newton formulated the law of universal gravitation in 1687.'
      },
      {
        id: 93,
        text: 'What is the longest bone in the human body?',
        optionA: 'Tibia',
        optionB: 'Humerus',
        optionC: 'Femur',
        optionD: 'Radius',
        correctAnswer: 'C',
        commentary: 'The femur (thigh bone) is the longest and strongest bone.'
      },
      {
        id: 94,
        text: 'In which year did World War I begin?',
        optionA: '1912',
        optionB: '1913',
        optionC: '1914',
        optionD: '1915',
        correctAnswer: 'C',
        commentary: 'World War I began on July 28, 1914.'
      },
      {
        id: 95,
        text: 'What is the capital of Russia?',
        optionA: 'St. Petersburg',
        optionB: 'Moscow',
        optionC: 'Kiev',
        optionD: 'Minsk',
        correctAnswer: 'B',
        commentary: 'Moscow has been the capital of Russia since 1918.'
      },
      {
        id: 96,
        text: 'How many teeth do adult dogs have?',
        optionA: '32',
        optionB: '38',
        optionC: '42',
        optionD: '46',
        correctAnswer: 'C',
        commentary: 'Adult dogs have 42 teeth, compared to humans\' 32.'
      },
      {
        id: 97,
        text: 'What is the symbol for helium?',
        optionA: 'H',
        optionB: 'He',
        optionC: 'Hl',
        optionD: 'Hm',
        correctAnswer: 'B',
        commentary: 'Helium (He) is the second lightest and second most abundant element.'
      },
      {
        id: 98,
        text: 'Who wrote "The Odyssey"?',
        optionA: 'Virgil',
        optionB: 'Homer',
        optionC: 'Sophocles',
        optionD: 'Plato',
        correctAnswer: 'B',
        commentary: 'Homer wrote The Odyssey around the 8th century BC.'
      },
      {
        id: 99,
        text: 'What is the largest island in the world?',
        optionA: 'New Guinea',
        optionB: 'Borneo',
        optionC: 'Greenland',
        optionD: 'Madagascar',
        correctAnswer: 'C',
        commentary: 'Greenland covers 2.16 million square kilometers.'
      },
      {
        id: 100,
        text: 'How many hours are in a week?',
        optionA: '156',
        optionB: '164',
        optionC: '168',
        optionD: '172',
        correctAnswer: 'C',
        commentary: 'There are 7 days × 24 hours = 168 hours in a week.'
      },
      {
        id: 101,
        text: 'What is the capital of India?',
        optionA: 'Mumbai',
        optionB: 'New Delhi',
        optionC: 'Bangalore',
        optionD: 'Kolkata',
        correctAnswer: 'B',
        commentary: 'New Delhi has been the capital of India since 1911.'
      },
      {
        id: 102,
        text: 'Who invented the airplane?',
        optionA: 'Henry Ford',
        optionB: 'Wright Brothers',
        optionC: 'Charles Lindbergh',
        optionD: 'Amelia Earhart',
        correctAnswer: 'B',
        commentary: 'The Wright Brothers made the first powered flight in 1903.'
      },
      {
        id: 103,
        text: 'What is the fastest fish in the ocean?',
        optionA: 'Tuna',
        optionB: 'Marlin',
        optionC: 'Sailfish',
        optionD: 'Swordfish',
        correctAnswer: 'C',
        commentary: 'Sailfish can swim up to 110 km/h (68 mph).'
      },
      {
        id: 104,
        text: 'How many cents are in a dollar?',
        optionA: '50',
        optionB: '100',
        optionC: '200',
        optionD: '1000',
        correctAnswer: 'B',
        commentary: 'One dollar equals 100 cents.'
      },
      {
        id: 105,
        text: 'What is the capital of Mexico?',
        optionA: 'Guadalajara',
        optionB: 'Cancun',
        optionC: 'Mexico City',
        optionD: 'Monterrey',
        correctAnswer: 'C',
        commentary: 'Mexico City has been the capital since 1821.'
      },
      {
        id: 106,
        text: 'Who composed "The Four Seasons"?',
        optionA: 'Mozart',
        optionB: 'Beethoven',
        optionC: 'Vivaldi',
        optionD: 'Bach',
        correctAnswer: 'C',
        commentary: 'Antonio Vivaldi composed The Four Seasons in 1725.'
      },
      {
        id: 107,
        text: 'What is the symbol for copper?',
        optionA: 'Co',
        optionB: 'Cp',
        optionC: 'Cu',
        optionD: 'C',
        correctAnswer: 'C',
        commentary: 'Cu comes from the Latin word "cuprum" for copper.'
      },
      {
        id: 108,
        text: 'In which country is the Taj Mahal located?',
        optionA: 'Pakistan',
        optionB: 'India',
        optionC: 'Bangladesh',
        optionD: 'Nepal',
        correctAnswer: 'B',
        commentary: 'The Taj Mahal is in Agra, India, built between 1632-1653.'
      },
      {
        id: 109,
        text: 'What is the largest volcano in the world?',
        optionA: 'Mount Vesuvius',
        optionB: 'Mount Fuji',
        optionC: 'Mauna Loa',
        optionD: 'Mount Etna',
        correctAnswer: 'C',
        commentary: 'Mauna Loa in Hawaii is the largest active volcano on Earth.'
      },
      {
        id: 110,
        text: 'How many degrees are in a right angle?',
        optionA: '45',
        optionB: '60',
        optionC: '90',
        optionD: '180',
        correctAnswer: 'C',
        commentary: 'A right angle measures exactly 90 degrees.'
      }
    ]

    // Shuffle and select questions up to questionCount
    const shuffled = questionBank.sort(() => Math.random() - 0.5)
    this.state.questions = shuffled.slice(0, this.state.questionCount)
  }

  private nextQuestion() {
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      this.endGame()
      return
    }

    const question = this.state.questions[this.state.currentQuestionIndex]
    this.state.currentQuestionAnswers.clear()
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
    if (this.state.currentQuestionAnswers.has(playerId)) {
      return // Already answered this question
    }

    const question = this.state.questions[this.state.currentQuestionIndex]
    const isCorrect = answer === question.correctAnswer

    // Store complete answer data
    this.state.answers.push({
      playerId,
      questionId: question.id,
      answer,
      isCorrect,
      timeTakenMs
    })

    this.state.currentQuestionAnswers.add(playerId)

    // Check if all players have answered
    if (this.state.currentQuestionAnswers.size === this.state.players.size) {
      this.endQuestion()
    }
  }

  private endQuestion() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    const question = this.state.questions[this.state.currentQuestionIndex]

    // Calculate scores for current question
    const currentAnswers = this.state.answers.filter(a => a.questionId === question.id)
    for (const answerData of currentAnswers) {
      const player = this.state.players.get(answerData.playerId)
      if (!player) continue

      if (answerData.isCorrect) {
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

  private handleGetResults() {
    // Calculate player statistics
    const playersWithStats = Array.from(this.state.players.values()).map(player => {
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

    // Calculate game statistics
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
