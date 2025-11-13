import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Gamepad2, Hash } from 'lucide-react'

export const Route = createFileRoute('/game/join')({
  component: JoinGame,
  ssr: false,
})

function JoinGame() {
  const navigate = useNavigate()
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    if (!roomCode.trim()) {
      setError('Please enter a room code')
      return
    }

    setIsJoining(true)
    setError('')

    try {
      const response = await fetch('/api/games/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          roomCode: roomCode.toUpperCase().replace(/\s/g, ''),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join game')
      }

      // Store game info in session storage
      sessionStorage.setItem('playerId', data.player.id)
      sessionStorage.setItem('playerName', data.player.name)
      sessionStorage.setItem('isHost', 'false')

      // Navigate to game lobby
      navigate({
        to: '/game/$roomCode',
        params: { roomCode: data.game.roomCode },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game')
      setIsJoining(false)
    }
  }

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    setRoomCode(value)
  }

  const formatRoomCodeDisplay = (code: string) => {
    if (code.length <= 2) return code
    return `${code.slice(0, 2)} ${code.slice(2, 4)}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <Gamepad2 className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Join Game</h1>
            <p className="text-gray-300">Enter the room code to join the battle</p>
          </div>

          <form onSubmit={handleJoinGame} className="space-y-6">
            {/* Room Code */}
            <div>
              <label className="block text-white mb-2 font-medium">
                <Hash className="inline w-4 h-4 mr-2" />
                Room Code
              </label>
              <input
                type="text"
                value={formatRoomCodeDisplay(roomCode)}
                onChange={handleRoomCodeChange}
                maxLength={5} // 4 chars + 1 space
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-center text-2xl font-mono tracking-widest placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                placeholder="AB 12"
                disabled={isJoining}
                autoComplete="off"
              />
              <p className="text-xs text-gray-400 mt-2">
                Ask your host for the 4-character code
              </p>
            </div>

            {/* Player Name */}
            <div>
              <label className="block text-white mb-2 font-medium">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                placeholder="Enter your name"
                disabled={isJoining}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isJoining || roomCode.length !== 4}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-lg shadow-lg transform transition hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining Game...' : 'Join Game'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-gray-300 mb-4">
              Don't have a room code?
            </p>
            <button
              onClick={() => navigate({ to: '/game/create' })}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition border border-white/20"
            >
              Create New Game
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate({ to: '/' })}
              className="text-gray-300 hover:text-white transition"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}