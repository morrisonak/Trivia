import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Monitor, Hash } from 'lucide-react'

export const Route = createFileRoute('/display')({
  component: DisplaySetup,
})

function DisplaySetup() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')

  const handleJoinAsDisplay = async (e: React.FormEvent) => {
    e.preventDefault()

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
          playerName: 'Big Board Display',
          roomCode: roomCode.toUpperCase().replace(/\s/g, ''),
          isDisplay: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join as display')
      }

      // Store display info in session storage
      sessionStorage.setItem('gameId', data.game.id)
      sessionStorage.setItem('playerId', data.player.id)
      sessionStorage.setItem('isDisplay', 'true')
      sessionStorage.setItem('roomCode', data.game.roomCode)

      // Navigate to big board view
      navigate({
        to: '/display/$roomCode',
        params: { roomCode: data.game.roomCode },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
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
            <Monitor className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Big Board Display</h1>
            <p className="text-gray-300">
              Connect this display to show the game on a TV or monitor
            </p>
          </div>

          <form onSubmit={handleJoinAsDisplay} className="space-y-6">
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
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-center text-3xl font-mono tracking-widest placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                placeholder="AB 12"
                disabled={isJoining}
                autoComplete="off"
              />
              <p className="text-xs text-gray-400 mt-2">
                Enter the 4-character code from the host's device
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h3 className="text-white font-medium mb-2">How it works:</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Display shows questions and scores on TV</li>
                <li>• Players use their phones to answer</li>
                <li>• Perfect for parties and group play</li>
                <li>• Enhanced animations and visuals</li>
              </ul>
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
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-500 disabled:to-gray-600 text-black font-bold rounded-lg shadow-lg transform transition hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed text-lg"
            >
              {isJoining ? 'Connecting...' : 'Connect as Display'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-gray-300 mb-4">
              Setup Instructions
            </p>
            <ol className="text-gray-400 text-sm space-y-2">
              <li>1. Connect this device to your TV/monitor</li>
              <li>2. Enter the room code from the host</li>
              <li>3. Full-screen the browser (F11)</li>
              <li>4. Enjoy the enhanced display!</li>
            </ol>
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