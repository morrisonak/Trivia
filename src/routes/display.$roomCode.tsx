import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import {
  Monitor,
  Users,
  Timer,
  Trophy,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Crown,
} from 'lucide-react'
import { formatRoomCode } from '@/lib/room-codes'

export const Route = createFileRoute('/display/$roomCode')({
  component: BigBoardDisplay,
})

interface Player {
  id: string
  name: string
  score: number
  isHost: boolean
  hasAnswered?: boolean
}

interface Question {
  id: number
  text: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
}

interface DisplayState {
  status: 'lobby' | 'playing' | 'results' | 'finished'
  players: Player[]
  currentQuestion: Question | null
  questionNumber: number
  totalQuestions: number
  timeRemaining: number
  correctAnswer: string | null
  commentary: string | null
  winner: Player | null
  showResults: boolean
}

function BigBoardDisplay() {
  const { roomCode } = Route.useParams()
  const navigate = useNavigate()
  const wsRef = useRef<WebSocket | null>(null)
  const [displayState, setDisplayState] = useState<DisplayState>({
    status: 'lobby',
    players: [],
    currentQuestion: null,
    questionNumber: 0,
    totalQuestions: 10,
    timeRemaining: 15,
    correctAnswer: null,
    commentary: null,
    winner: null,
    showResults: false,
  })
  const [loading, setLoading] = useState(true)
  const [playerAnswerStatus, setPlayerAnswerStatus] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    // Verify display session
    const isDisplay = sessionStorage.getItem('isDisplay')
    const playerId = sessionStorage.getItem('playerId')

    if (!isDisplay || !playerId) {
      navigate({ to: '/display' })
      return
    }

    // Connect to WebSocket
    connectWebSocket(playerId)

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [roomCode])

  const connectWebSocket = (playerId: string) => {
    console.log('Connecting display to WebSocket for room:', roomCode)

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/games/${roomCode}/ws?playerId=${playerId}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('Display WebSocket connected')
      setLoading(false)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('Display received WebSocket message:', message)

        switch (message.type) {
          case 'state':
            // Update lobby state
            setDisplayState(prev => ({
              ...prev,
              status: message.data.status,
              players: message.data.players || [],
              totalQuestions: message.data.questionCount || 10,
            }))
            break

          case 'game_started':
            setDisplayState(prev => ({
              ...prev,
              status: 'playing',
            }))
            break

          case 'question':
            // New question - reset answer tracking
            setPlayerAnswerStatus(new Map())
            setDisplayState(prev => ({
              ...prev,
              status: 'playing',
              currentQuestion: message.data.question,
              questionNumber: message.data.questionNumber,
              totalQuestions: message.data.totalQuestions,
              timeRemaining: 15,
              correctAnswer: null,
              commentary: null,
              showResults: false,
            }))
            break

          case 'timer':
            setDisplayState(prev => ({
              ...prev,
              timeRemaining: message.data.timeRemaining
            }))
            break

          case 'results':
            // Show answer results
            const updatedPlayers = message.data.players || displayState.players
            setDisplayState(prev => ({
              ...prev,
              correctAnswer: message.data.correctAnswer,
              commentary: message.data.commentary,
              players: updatedPlayers,
              showResults: true,
            }))
            break

          case 'game_ended':
            // Game finished
            const finalPlayers = message.data.players || displayState.players
            const sortedPlayers = [...finalPlayers].sort((a, b) => b.score - a.score)
            setDisplayState(prev => ({
              ...prev,
              status: 'results',
              players: sortedPlayers,
              winner: sortedPlayers[0] || null,
            }))
            break
        }
      } catch (err) {
        console.error('Failed to parse display WebSocket message:', err)
      }
    }

    ws.onerror = (error) => {
      console.error('Display WebSocket error:', error)
      setLoading(false)
    }

    ws.onclose = () => {
      console.log('Display WebSocket disconnected')
      // Attempt to reconnect after 2 seconds
      setTimeout(() => {
        const playerId = sessionStorage.getItem('playerId')
        if (playerId) {
          connectWebSocket(playerId)
        }
      }, 2000)
    }

    wsRef.current = ws
  }

  const renderLobby = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="text-center mb-12">
        <h1 className="text-8xl font-black text-white mb-4">TRIVIA NIGHTS</h1>
        <div className="text-6xl font-mono font-bold text-yellow-400 tracking-wider mb-4">
          {formatRoomCode(roomCode)}
        </div>
        <p className="text-3xl text-gray-300">
          Join with code on your device!
        </p>
      </div>

      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Users className="w-10 h-10 text-yellow-400" />
          <h2 className="text-4xl font-bold text-white">
            Players ({displayState.players.length}/4)
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {displayState.players.map((player, index) => (
            <div
              key={player.id}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border-2 border-white/20 animate-slide-in flex items-center justify-between"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-yellow-400">
                  {index + 1}
                </div>
                <span className="text-3xl text-white font-semibold">
                  {player.name}
                </span>
              </div>
              {player.isHost && (
                <Crown className="w-8 h-8 text-yellow-400" />
              )}
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 4 - displayState.players.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="bg-white/5 rounded-xl p-6 border-2 border-white/10 border-dashed flex items-center justify-center"
            >
              <span className="text-2xl text-gray-500">Waiting...</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 animate-pulse">
        <Play className="w-16 h-16 text-green-400 mx-auto" />
        <p className="text-2xl text-gray-300 mt-4">
          Waiting for host to start...
        </p>
      </div>
    </div>
  )

  const renderPlaying = () => (
    <div className="min-h-screen p-8 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="text-white">
          <p className="text-2xl opacity-80">
            Question {displayState.questionNumber} of {displayState.totalQuestions}
          </p>
        </div>

        {/* Timer - Large and prominent */}
        <div
          className={`flex items-center gap-4 px-8 py-4 rounded-xl text-4xl font-bold ${
            displayState.timeRemaining <= 5
              ? 'bg-red-500/30 text-red-300 animate-pulse'
              : 'bg-white/10 text-white'
          }`}
        >
          <Timer className="w-10 h-10" />
          <span className="font-mono">{displayState.timeRemaining}</span>
        </div>
      </div>

      {/* Question */}
      {displayState.currentQuestion && (
        <div className="flex-1 flex flex-col justify-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border-2 border-white/20 mb-8">
            <h2 className="text-5xl font-bold text-white text-center mb-12">
              {displayState.currentQuestion.text}
            </h2>

            {/* Answer Options */}
            <div className="grid grid-cols-2 gap-8">
              {[
                { key: 'A', text: displayState.currentQuestion.optionA, color: 'bg-blue-500/20 border-blue-400' },
                { key: 'B', text: displayState.currentQuestion.optionB, color: 'bg-green-500/20 border-green-400' },
                { key: 'C', text: displayState.currentQuestion.optionC, color: 'bg-yellow-500/20 border-yellow-400' },
                { key: 'D', text: displayState.currentQuestion.optionD, color: 'bg-purple-500/20 border-purple-400' },
              ].map((option) => (
                <div
                  key={option.key}
                  className={`p-6 rounded-xl border-2 ${
                    displayState.correctAnswer === option.key
                      ? 'bg-green-500/30 border-green-500 animate-pulse'
                      : displayState.correctAnswer
                      ? 'opacity-50'
                      : option.color
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-black text-white">
                      {option.key}
                    </span>
                    <span className="text-2xl text-white">{option.text}</span>
                    {displayState.correctAnswer === option.key && (
                      <CheckCircle className="w-10 h-10 text-green-400 ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Commentary */}
            {displayState.commentary && (
              <div className="mt-8 p-6 bg-yellow-400/20 rounded-xl border-2 border-yellow-400/50">
                <p className="text-2xl text-yellow-100 text-center italic">
                  "{displayState.commentary}"
                </p>
              </div>
            )}
          </div>

          {/* Player Status Bar */}
          <div className="flex justify-center gap-6">
            {displayState.players.map((player) => (
              <div
                key={player.id}
                className="bg-white/10 rounded-xl px-6 py-3 border border-white/20"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl text-white">{player.name}</span>
                  {player.hasAnswered ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
                  )}
                  <span className="text-xl font-bold text-yellow-400">
                    {player.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderResults = () => (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center">
      <Trophy className="w-32 h-32 text-yellow-400 mb-8 animate-bounce" />

      <h1 className="text-7xl font-black text-white mb-4">
        {displayState.winner ? `${displayState.winner.name} Wins!` : 'Game Over!'}
      </h1>

      {displayState.winner && (
        <p className="text-4xl text-yellow-400 mb-12">
          Final Score: {displayState.winner.score}
        </p>
      )}

      <div className="w-full max-w-4xl">
        <h2 className="text-4xl font-bold text-white text-center mb-8">
          Final Leaderboard
        </h2>

        <div className="space-y-4">
          {displayState.players
            .sort((a, b) => b.score - a.score)
            .map((player, index) => {
              const rank = index + 1
              const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-6 rounded-xl ${
                    rank === 1
                      ? 'bg-yellow-400/20 border-2 border-yellow-400'
                      : 'bg-white/10 border border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-6">
                    <span className="text-4xl font-bold text-white">
                      {rankEmoji}
                    </span>
                    <span className="text-3xl text-white font-semibold">
                      {player.name}
                    </span>
                  </div>
                  <div className="text-4xl font-bold text-yellow-400">
                    {player.score}
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      <div className="mt-12 text-3xl text-gray-400">
        Thanks for playing!
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Monitor className="w-20 h-20 text-yellow-400 animate-pulse mx-auto mb-4" />
          <p className="text-3xl text-white">Connecting to game...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {displayState.status === 'lobby' && renderLobby()}
      {displayState.status === 'playing' && renderPlaying()}
      {displayState.status === 'results' && renderResults()}
    </div>
  )
}