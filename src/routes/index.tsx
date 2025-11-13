import { createFileRoute, Link } from '@tanstack/react-router'
import { Gamepad2, Users, Trophy, Sparkles, Monitor, Zap } from 'lucide-react'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const features = [
    {
      icon: <Gamepad2 className="w-10 h-10" />,
      title: 'Quick Match',
      description: 'Jump into a 3-5 minute trivia game with friends',
    },
    {
      icon: <Users className="w-10 h-10" />,
      title: '2-4 Players',
      description: 'Perfect for small groups and family game nights',
    },
    {
      icon: <Monitor className="w-10 h-10" />,
      title: 'Big Board Display',
      description: 'Optional TV mode for enhanced group experience',
    },
    {
      icon: <Zap className="w-10 h-10" />,
      title: 'Real-time Sync',
      description: 'Instant updates across all devices',
    },
    {
      icon: <Trophy className="w-10 h-10" />,
      title: 'Competitive Scoring',
      description: 'Speed bonuses and streak rewards',
    },
    {
      icon: <Sparkles className="w-10 h-10" />,
      title: 'Witty Commentary',
      description: 'Humorous explanations after each answer',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-6 py-24">
          <div className="text-center">
            <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tight">
              TRIVIA
              <span className="block text-4xl md:text-6xl bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                BATTLE
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl mx-auto">
              The multiplayer trivia game that brings friends together for quick,
              hilarious battles of wit
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/game/create"
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-full text-lg shadow-lg transform transition hover:scale-105"
              >
                Create Game
              </Link>
              <Link
                to="/game/join"
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold rounded-full text-lg shadow-lg transform transition hover:scale-105"
              >
                Join Game
              </Link>
            </div>
            <div className="mt-6">
              <p className="text-gray-300 text-sm">
                Enter a 4-character room code to join an existing game
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Why You'll Love It
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all"
            >
              <div className="text-yellow-400 mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How to Play */}
      <div className="container mx-auto px-6 py-16">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            How to Play
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-400 text-black rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-4">
                1
              </div>
              <h3 className="text-white font-bold mb-2">Create or Join</h3>
              <p className="text-gray-300 text-sm">
                Start a new game or enter a room code
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-400 text-black rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-4">
                2
              </div>
              <h3 className="text-white font-bold mb-2">Wait for Players</h3>
              <p className="text-gray-300 text-sm">
                2-4 players needed to start
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-400 text-black rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-4">
                3
              </div>
              <h3 className="text-white font-bold mb-2">Answer Fast</h3>
              <p className="text-gray-300 text-sm">
                15 seconds per question, speed matters!
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-400 text-black rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-4">
                4
              </div>
              <h3 className="text-white font-bold mb-2">Win Glory</h3>
              <p className="text-gray-300 text-sm">
                Top scorer wins bragging rights
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Big Board CTA */}
      <div className="container mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-center">
          <Monitor className="w-16 h-16 text-white mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">
            Enhance with Big Board Display
          </h2>
          <p className="text-gray-100 max-w-2xl mx-auto mb-6">
            Connect a TV or monitor to show the game on the big screen while
            players use their phones as controllers. Perfect for parties!
          </p>
          <Link
            to="/display"
            className="inline-block px-6 py-3 bg-white text-indigo-600 font-bold rounded-full hover:bg-gray-100 transition"
          >
            Learn About Big Board
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-white/20">
        <div className="text-center text-gray-400 text-sm">
          <p>Built with TanStack Start • Powered by Cloudflare Workers</p>
        </div>
      </footer>
    </div>
  )
}