import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Users, Copy, Check, Play, Crown, Loader2 } from 'lucide-react'
import { formatRoomCode } from '@/lib/room-codes'

export const Route = createFileRoute('/game/$roomCode')({
  component: GameLobby,
})

interface Player {
  id: number
  name: string
  isHost: boolean
  score: number
}

interface GameState {
  id: number
  roomCode: string
  status: 'lobby' | 'playing' | 'finished'
  maxPlayers: number
  questionCount: number
  players: Player[]
}

function GameLobby() {
  const { roomCode } = Route.useParams()
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Get player info from session storage - ONLY on client
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)

  useEffect(() => {
    // Read from sessionStorage only in useEffect (client-side only)
    const storedPlayerId = sessionStorage.getItem('playerId')
    const storedPlayerName = sessionStorage.getItem('playerName')
    const storedIsHost = sessionStorage.getItem('isHost') === 'true'

    setPlayerId(storedPlayerId)
    setPlayerName(storedPlayerName)
    setIsHost(storedIsHost)

    if (!storedPlayerId || !storedPlayerName) {
      navigate({ to: '/' })
      return
    }

    // Only run lobby logic if we're actually on the lobby page
    // If we're on the play page, don't start polling or clear flags
    const currentPath = window.location.pathname
    if (currentPath.includes('/play')) {
      console.log('Already on play page, not starting lobby polling')
      return
    }

    // Clear navigation flag when entering lobby
    sessionStorage.removeItem('navigatedToPlay')

    // Initial load - fetch game state
    fetchGameState()

    // Poll for updates (temporary until WebSockets are implemented)
    intervalRef.current = setInterval(fetchGameState, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [roomCode])

  const fetchGameState = async () => {
    // Don't fetch if we've already started navigating
    if (sessionStorage.getItem('navigatedToPlay')) {
      console.log('Already navigated, skipping fetch')
      return
    }

    try {
      const response = await fetch(`/api/games/${roomCode}`)
      if (!response.ok) {
        throw new Error('Failed to fetch game state')
      }
      const data = await response.json()
      console.log('Game state fetched:', data)
      setGameState(data)
      setLoading(false)

      // If game has started and we haven't navigated yet, navigate to play page
      if (data.status === 'playing') {
        console.log('Game is playing, navigating to play page...')

        // Mark that we've navigated to prevent loops BEFORE navigating
        sessionStorage.setItem('navigatedToPlay', 'true')

        // Clear the polling interval before navigation
        if (intervalRef.current) {
          console.log('Clearing polling interval before navigation')
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }

        // Navigate with player info in URL to avoid SSR issues
        // Read directly from sessionStorage here since state might not be updated yet
        const currentPlayerId = sessionStorage.getItem('playerId')
        const currentPlayerName = sessionStorage.getItem('playerName')
        console.log('Navigating with window.location.href')
        window.location.href = `/game/${roomCode}/play?playerId=${currentPlayerId}&playerName=${encodeURIComponent(currentPlayerName || '')}`
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game')
      setLoading(false)
    }
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const startGame = async () => {
    if (!isHost) return

    try {
      const response = await fetch(`/api/games/${roomCode}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start game')
      }

      // Clear the polling interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      // Mark navigation flag
      sessionStorage.setItem('navigatedToPlay', 'true')

      // Navigate immediately for the host with player info in URL
      // Read directly from sessionStorage since state might not be updated yet
      const currentPlayerId = sessionStorage.getItem('playerId')
      const currentPlayerName = sessionStorage.getItem('playerName')
      window.location.href = `/game/${roomCode}/play?playerId=${currentPlayerId}&playerName=${encodeURIComponent(currentPlayerName || '')}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
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

  if (!gameState) {
    return null
  }

  const canStart = isHost && gameState.players.length >= 2

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          {/* Room Code Display */}
          <div className="text-center mb-8">
            <h2 className="text-xl text-gray-300 mb-2">Room Code</h2>
            <div className="flex items-center justify-center gap-4">
              <div className="text-6xl font-mono font-bold text-yellow-400 tracking-wider">
                {formatRoomCode(roomCode)}
              </div>
              <button
                onClick={copyRoomCode}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all border border-white/20"
                title="Copy room code"
              >
                {copied ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : (
                  <Copy className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
            <p className="text-gray-400 mt-2">
              Share this code with your friends to join
            </p>
          </div>

          {/* Player List */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Players ({gameState.players.length}/{gameState.maxPlayers})
              </h3>
            </div>

            <div className="space-y-2">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    player.id === Number(playerId)
                      ? 'bg-yellow-400/20 border-yellow-400/50'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{player.name}</span>
                    {player.id === Number(playerId) && (
                      <span className="text-xs bg-yellow-400/30 text-yellow-200 px-2 py-1 rounded">
                        You
                      </span>
                    )}
                  </div>
                  {player.isHost && (
                    <Crown className="w-5 h-5 text-yellow-400" />
                  )}
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: gameState.maxPlayers - gameState.players.length }).map(
                (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center p-3 rounded-lg border border-white/10 bg-white/5 border-dashed"
                  >
                    <span className="text-gray-500">Waiting for player...</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Game Settings */}
          <div className="mb-8 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-white font-medium mb-2">Game Settings</h3>
            <div className="text-gray-300 text-sm space-y-1">
              <p>Questions: {gameState.questionCount}</p>
              <p>Time per question: 15 seconds</p>
              <p>Estimated duration: {Math.ceil((gameState.questionCount * 30) / 60)} minutes</p>
            </div>
          </div>

          {/* Actions */}
          {isHost ? (
            <div className="space-y-3">
              <button
                onClick={startGame}
                disabled={!canStart}
                className={`w-full py-4 font-bold rounded-lg shadow-lg transform transition ${
                  canStart
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:scale-105'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Play className="inline w-5 h-5 mr-2" />
                {canStart
                  ? 'Start Game'
                  : `Need at least 2 players (${gameState.players.length}/${gameState.maxPlayers})`}
              </button>
              <p className="text-center text-gray-400 text-sm">
                You're the host. Start the game when everyone is ready!
              </p>
            </div>
          ) : (
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-300">
                Waiting for host to start the game...
              </p>
            </div>
          )}

          {/* Leave Game */}
          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <button
              onClick={() => {
                sessionStorage.clear()
                navigate({ to: '/' })
              }}
              className="text-gray-400 hover:text-white transition"
            >
              Leave Game
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}