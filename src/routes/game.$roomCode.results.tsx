import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Trophy, Medal, Award, Star, Home, RotateCcw, Loader2 } from 'lucide-react'
import { getRankEmoji } from '@/lib/scoring'

export const Route = createFileRoute('/game/$roomCode/results')({
  component: GameResults,
  ssr: false, // Uses sessionStorage - client-only
})

interface Player {
  id: number
  name: string
  score: number
  correctAnswers: number
  totalAnswers: number
  accuracy: number
}

interface GameResults {
  players: Player[]
  winner: Player | null
  gameStats: {
    totalQuestions: number
    averageScore: number
    highestScore: number
  }
}

function GameResults() {
  const { roomCode } = Route.useParams()
  const navigate = useNavigate()
  const [results, setResults] = useState<GameResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingGame, setCreatingGame] = useState(false)
  const [waitingForHost, setWaitingForHost] = useState(false)
  const isCreatingRef = useRef(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const playerId = sessionStorage.getItem('playerId')
  const playerName = sessionStorage.getItem('playerName')
  const isHost = sessionStorage.getItem('isHost') === 'true'

  useEffect(() => {
    if (!playerId || !playerName) {
      navigate({ to: '/' })
      return
    }

    fetchResults()

    // Cleanup polling on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [roomCode])

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/games/${roomCode}/results`)
      if (!response.ok) {
        throw new Error('Failed to fetch results')
      }
      const data = await response.json()
      setResults(data)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results')
      setLoading(false)
    }
  }

  const playAgainAsHost = async () => {
    if (!playerName || creatingGame || isCreatingRef.current) return

    isCreatingRef.current = true
    setCreatingGame(true)
    setError('')

    try {
      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          maxPlayers: 4,
          questionCount: 10,
          previousRoomCode: roomCode, // Include previous room code for auto-join
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create game')
      }

      // Store new game info in session storage
      sessionStorage.setItem('playerId', data.player.id)
      sessionStorage.setItem('playerName', data.player.name)
      sessionStorage.setItem('isHost', 'true')

      // Navigate to new game lobby
      navigate({
        to: '/game/$roomCode',
        params: { roomCode: data.game.roomCode },
      })
      // Don't reset isCreatingRef since we're navigating away
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game')
      setCreatingGame(false)
      isCreatingRef.current = false
    }
  }

  const waitForHostToCreateGame = () => {
    setWaitingForHost(true)
    setError('')

    // Poll for new game room
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/games/${roomCode}/next-game`)
        if (response.ok) {
          const data = await response.json()
          if (data.newRoomCode) {
            // Stop polling
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
            }

            // Auto-join the new game
            const joinResponse = await fetch(`/api/games/${data.newRoomCode}/join`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerName: playerName?.trim() }),
            })

            const joinData = await joinResponse.json()

            if (!joinResponse.ok) {
              throw new Error(joinData.error || 'Failed to join new game')
            }

            // Store new game info
            sessionStorage.setItem('playerId', joinData.playerId)
            sessionStorage.setItem('playerName', playerName!)
            sessionStorage.setItem('isHost', 'false')

            // Navigate to new game
            navigate({
              to: '/game/$roomCode',
              params: { roomCode: data.newRoomCode },
            })
          }
        }
      } catch (err) {
        console.error('Error polling for new game:', err)
      }
    }, 2000) // Poll every 2 seconds
  }

  const goHome = () => {
    sessionStorage.clear()
    navigate({ to: '/' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-xl">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error || 'Failed to load results'}</p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const currentPlayer = results.players.find((p) => p.id === Number(playerId))
  const currentPlayerRank = results.players.findIndex((p) => p.id === Number(playerId)) + 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Winner Announcement */}
        {results.winner && (
          <div className="text-center mb-8 animate-fade-in">
            <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-bounce" />
            <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
              {results.winner.id === Number(playerId) ? 'You Win!' : `${results.winner.name} Wins!`}
            </h1>
            <p className="text-2xl text-yellow-400">
              Score: {results.winner.score} points
            </p>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center justify-center gap-2">
            <Medal className="w-6 h-6 text-yellow-400" />
            Final Leaderboard
          </h2>

          <div className="space-y-3">
            {results.players.map((player, index) => {
              const rank = index + 1
              const isCurrentPlayer = player.id === Number(playerId)
              const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                    isCurrentPlayer
                      ? 'bg-yellow-400/20 border-2 border-yellow-400/50'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-white w-12 text-center">
                      {rankIcon || `#${rank}`}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-lg">
                          {player.name}
                        </span>
                        {isCurrentPlayer && (
                          <span className="text-xs bg-yellow-400/30 text-yellow-200 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-gray-300 text-sm">
                        {player.correctAnswers}/{player.totalAnswers} correct • {player.accuracy}% accuracy
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      {player.score}
                    </div>
                    <div className="text-xs text-gray-400">points</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Personal Stats */}
        {currentPlayer && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Your Performance
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Final Rank</p>
                <p className="text-2xl font-bold text-white">
                  {getRankEmoji(currentPlayerRank)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Total Score</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {currentPlayer.score}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Correct</p>
                <p className="text-2xl font-bold text-green-400">
                  {currentPlayer.correctAnswers}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-gray-400 text-sm">Accuracy</p>
                <p className="text-2xl font-bold text-blue-400">
                  {currentPlayer.accuracy}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Game Stats */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            Game Statistics
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-gray-400 text-sm">Questions</p>
              <p className="text-xl font-bold text-white">
                {results.gameStats.totalQuestions}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Avg Score</p>
              <p className="text-xl font-bold text-white">
                {Math.round(results.gameStats.averageScore)}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">High Score</p>
              <p className="text-xl font-bold text-white">
                {results.gameStats.highestScore}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {isHost ? (
            <button
              onClick={playAgainAsHost}
              disabled={creatingGame}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 [@media(hover:hover)]:hover:from-green-600 [@media(hover:hover)]:hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-full shadow-lg transform transition [@media(hover:hover)]:hover:scale-105 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creatingGame ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Game...
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5" />
                  Play Again (Host)
                </>
              )}
            </button>
          ) : (
            <button
              onClick={waitForHostToCreateGame}
              disabled={waitingForHost}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 [@media(hover:hover)]:hover:from-blue-600 [@media(hover:hover)]:hover:to-cyan-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-full shadow-lg transform transition [@media(hover:hover)]:hover:scale-105 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {waitingForHost ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Waiting for host...
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5" />
                  Ready to Play Again
                </>
              )}
            </button>
          )}
          <button
            onClick={goHome}
            disabled={creatingGame || waitingForHost}
            className="px-8 py-3 bg-white/10 [@media(hover:hover)]:hover:bg-white/20 text-white font-bold rounded-full shadow-lg transform transition [@media(hover:hover)]:hover:scale-105 border border-white/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </button>
        </div>

        {/* Room Code */}
        <div className="text-center text-gray-400 text-sm mt-8">
          Room: {roomCode}
        </div>
      </div>
    </div>
  )
}