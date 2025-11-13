import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Gamepad2, Users, Timer, HelpCircle } from 'lucide-react'

export const Route = createFileRoute('/game/create')({
  component: CreateGame,
  ssr: false,
})

function CreateGame() {
  const navigate = useNavigate()
  const [playerName, setPlayerName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [questionCount, setQuestionCount] = useState(10)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          maxPlayers,
          questionCount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create game')
      }

      // Store game info in session storage
      sessionStorage.setItem('playerId', data.player.id)
      sessionStorage.setItem('playerName', data.player.name)
      sessionStorage.setItem('isHost', 'true')

      // Navigate to game lobby
      navigate({
        to: '/game/$roomCode',
        params: { roomCode: data.game.roomCode },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game')
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <Gamepad2 className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Create New Game</h1>
            <p className="text-gray-300">Set up your trivia battle arena</p>
          </div>

          <form onSubmit={handleCreateGame} className="space-y-6">
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
                disabled={isCreating}
              />
            </div>

            {/* Max Players */}
            <div>
              <label className="block text-white mb-2 font-medium">
                <Users className="inline w-4 h-4 mr-2" />
                Max Players
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setMaxPlayers(num)}
                    disabled={isCreating}
                    className={`py-2 px-4 rounded-lg font-medium transition-all ${
                      maxPlayers === num
                        ? 'bg-yellow-400 text-black'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                    }`}
                  >
                    {num} Players
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="block text-white mb-2 font-medium">
                <HelpCircle className="inline w-4 h-4 mr-2" />
                Number of Questions
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 15].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuestionCount(num)}
                    disabled={isCreating}
                    className={`py-2 px-4 rounded-lg font-medium transition-all ${
                      questionCount === num
                        ? 'bg-yellow-400 text-black'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Game Duration Estimate */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center text-gray-300">
                <Timer className="w-5 h-5 mr-2" />
                <span className="text-sm">
                  Estimated duration: {Math.ceil((questionCount * 30) / 60)} minutes
                </span>
              </div>
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
              disabled={isCreating}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-lg shadow-lg transform transition hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating Game...' : 'Create Game'}
            </button>
          </form>

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