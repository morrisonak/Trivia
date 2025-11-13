import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Timer, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Question {
  id: number
  text: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
}

interface GameState {
  currentQuestion: Question | null
  questionNumber: number
  totalQuestions: number
  timeRemaining: number
  playerScore: number
  hasAnswered: boolean
  correctAnswer: string | null
  selectedAnswer: string | null
  showResults: boolean
  commentary: string | null
  gameOver: boolean
}

function GamePlayComponent() {
  const { roomCode } = Route.useParams()
  const navigate = Route.useNavigate()

  const [gameState, setGameState] = useState<GameState>({
    currentQuestion: null,
    questionNumber: 0,
    totalQuestions: 10,
    timeRemaining: 15,
    playerScore: 0,
    hasAnswered: false,
    correctAnswer: null,
    selectedAnswer: null,
    showResults: false,
    commentary: null,
    gameOver: false,
  })
  const [loading, setLoading] = useState(true)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Get player info from URL params or sessionStorage as fallback
    const urlParams = new URLSearchParams(window.location.search)
    const urlPlayerId = urlParams.get('playerId')
    const urlPlayerName = urlParams.get('playerName')

    const storedPlayerId = urlPlayerId || sessionStorage.getItem('playerId')
    const storedPlayerName = urlPlayerName || sessionStorage.getItem('playerName')

    console.log('Play page mounted, player info:', { storedPlayerId, storedPlayerName, roomCode })

    if (!storedPlayerId || !storedPlayerName) {
      console.log('No player info, redirecting to home')
      navigate({ to: '/' })
      return
    }

    setPlayerId(storedPlayerId)
    setPlayerName(storedPlayerName)

    // Connect to Durable Object's WebSocket
    connectWebSocket(storedPlayerId)

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [roomCode])

  const connectWebSocket = (playerId: string) => {
    console.log('Connecting to WebSocket for room:', roomCode, 'player:', playerId)

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/games/${roomCode}/ws?playerId=${playerId}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected for gameplay')
      setLoading(false)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('WebSocket message:', message)

        switch (message.type) {
          case 'question':
            setGameState({
              currentQuestion: message.data.question,
              questionNumber: message.data.questionNumber,
              totalQuestions: message.data.totalQuestions,
              timeRemaining: 15,
              playerScore: gameState.playerScore,
              hasAnswered: false,
              correctAnswer: null,
              selectedAnswer: null,
              showResults: false,
              commentary: null,
              gameOver: false,
            })
            break

          case 'timer':
            setGameState(prev => ({
              ...prev,
              timeRemaining: message.data.timeRemaining
            }))
            break

          case 'results':
            const myScore = message.data.players.find((p: any) => p.id === playerId)?.score || gameState.playerScore
            setGameState(prev => ({
              ...prev,
              correctAnswer: message.data.correctAnswer,
              showResults: true,
              commentary: message.data.commentary,
              playerScore: myScore,
              gameOver: message.data.isLastQuestion
            }))

            if (message.data.isLastQuestion) {
              setTimeout(() => {
                navigate({ to: `/game/${roomCode}/results` })
              }, 4000)
            }
            break

          case 'game_ended':
            navigate({ to: `/game/${roomCode}/results` })
            break
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setLoading(false)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
    }

    wsRef.current = ws
  }

  const handleAnswer = (answer: string | null) => {
    if (gameState.hasAnswered || !wsRef.current) return

    console.log('Submitting answer:', answer)

    const timeTaken = (15 - gameState.timeRemaining) * 1000

    wsRef.current.send(JSON.stringify({
      type: 'answer',
      playerId,
      answer,
      timeTakenMs: timeTaken
    }))

    setGameState(prev => ({
      ...prev,
      hasAnswered: true,
      selectedAnswer: answer
    }))
  }

  const getButtonClass = (option: string) => {
    if (!gameState.showResults) {
      return 'bg-white/10 border-white/20 text-white [@media(hover:hover)]:hover:bg-white/20'
    }

    if (option === gameState.correctAnswer) {
      return 'bg-green-500/30 border-green-500 text-green-100'
    }

    if (option === gameState.selectedAnswer && option !== gameState.correctAnswer) {
      return 'bg-red-500/30 border-red-500 text-red-100'
    }

    return 'bg-white/5 border-white/10 text-gray-400'
  }

  const getButtonIcon = (option: string) => {
    if (!gameState.showResults) return null

    if (option === gameState.correctAnswer) {
      return <CheckCircle className="w-5 h-5" />
    }

    if (option === gameState.selectedAnswer && option !== gameState.correctAnswer) {
      return <XCircle className="w-5 h-5" />
    }

    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-xl">Connecting to game...</p>
        </div>
      </div>
    )
  }

  if (!gameState.currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-xl">Waiting for next question...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-white">
            <p className="text-sm opacity-80">Question {gameState.questionNumber} of {gameState.totalQuestions}</p>
            <p className="text-lg font-bold">Score: {gameState.playerScore}</p>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            gameState.timeRemaining <= 5
              ? 'bg-red-500/20 text-red-300'
              : 'bg-white/10 text-white'
          }`}>
            <Timer className="w-5 h-5" />
            <span className="text-2xl font-mono font-bold">
              {gameState.timeRemaining}
            </span>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">
            {gameState.currentQuestion.text}
          </h2>

          {/* Answer Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'A', text: gameState.currentQuestion.optionA },
              { key: 'B', text: gameState.currentQuestion.optionB },
              { key: 'C', text: gameState.currentQuestion.optionC },
              { key: 'D', text: gameState.currentQuestion.optionD },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => handleAnswer(option.key)}
                disabled={gameState.hasAnswered}
                className={`p-4 rounded-lg border-2 font-medium transition-all transform [@media(hover:hover)]:hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-between ${getButtonClass(option.key)}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{option.key}</span>
                  <span className="text-left">{option.text}</span>
                </div>
                {getButtonIcon(option.key)}
              </button>
            ))}
          </div>

          {/* Commentary */}
          {gameState.showResults && gameState.commentary && (
            <div className="mt-6 p-4 bg-yellow-400/20 rounded-lg border border-yellow-400/50">
              <p className="text-yellow-100 text-center italic">
                "{gameState.commentary}"
              </p>
            </div>
          )}

          {/* Waiting Message */}
          {gameState.hasAnswered && !gameState.showResults && (
            <div className="mt-6 text-center">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-2" />
              <p className="text-gray-300">Waiting for all players to answer...</p>
            </div>
          )}

          {/* Result Message */}
          {gameState.showResults && (
            <div className="mt-6 text-center">
              {gameState.selectedAnswer === gameState.correctAnswer ? (
                <p className="text-green-400 text-xl font-bold">Correct! 🎉</p>
              ) : gameState.selectedAnswer ? (
                <p className="text-red-400 text-xl font-bold">Wrong answer 😔</p>
              ) : (
                <p className="text-yellow-400 text-xl font-bold">Time's up! ⏰</p>
              )}
              {!gameState.gameOver && (
                <p className="text-gray-300 mt-2">Next question coming up...</p>
              )}
            </div>
          )}
        </div>

        {/* Room Code */}
        <div className="text-center text-gray-400 text-sm">
          Room: {roomCode}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/game/$roomCode/play')({
  component: GamePlayComponent,
  ssr: false,
})