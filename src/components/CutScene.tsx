import { useCallback, useEffect, useRef, useState } from 'react'

export type Scene =
  | { kind: 'start' }
  | { kind: 'question'; questionNumber: number; totalQuestions: number; category: string | null; isLastQuestion: boolean }
  | { kind: 'final' }

const EXIT_MS = 450

// Rotating backdrops so consecutive question intros don't look identical
const QUESTION_BACKDROPS = [
  'from-fuchsia-600 via-purple-700 to-indigo-800',
  'from-sky-500 via-blue-700 to-indigo-900',
  'from-emerald-500 via-teal-700 to-cyan-900',
  'from-orange-500 via-rose-600 to-purple-800',
]

// Show a cut scene, then wipe it away when the next screen is ready
export function useCutScene() {
  const [scene, setScene] = useState<Scene | null>(null)
  const [exiting, setExiting] = useState(false)
  const sceneRef = useRef<Scene | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: Scene) => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    sceneRef.current = next
    setExiting(false)
    setScene(next)
  }, [])

  const hide = useCallback(() => {
    if (!sceneRef.current) return
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    setExiting(true)
    exitTimerRef.current = setTimeout(() => {
      sceneRef.current = null
      setScene(null)
      setExiting(false)
    }, EXIT_MS)
  }, [])

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
  }, [])

  return { scene, exiting, show, hide }
}

export function CutScene({
  scene,
  exiting,
  size = 'phone',
}: {
  scene: Scene | null
  exiting: boolean
  size?: 'phone' | 'board'
}) {
  if (!scene) return null

  const board = size === 'board'
  const headline = board ? 'text-[9rem] leading-none' : 'text-6xl'
  const subline = board ? 'text-5xl' : 'text-2xl'
  const chip = board ? 'text-3xl px-8 py-3' : 'text-base px-4 py-1.5'

  let backdrop = 'from-yellow-500 via-orange-600 to-rose-700'
  let content: React.ReactNode

  if (scene.kind === 'start') {
    content = (
      <>
        <p className={`${subline} font-bold text-white/80 uppercase tracking-[0.3em] animate-rise-in`}>
          Trivia Nights
        </p>
        <h1 className={`${headline} font-black text-white uppercase drop-shadow-lg animate-slam-in`} style={{ animationDelay: '0.3s' }}>
          Get Ready!
        </h1>
      </>
    )
  } else if (scene.kind === 'question') {
    backdrop = scene.isLastQuestion
      ? 'from-red-600 via-rose-700 to-black'
      : QUESTION_BACKDROPS[(scene.questionNumber - 1) % QUESTION_BACKDROPS.length]
    content = (
      <>
        <p className={`${subline} font-bold text-white/80 uppercase tracking-[0.3em] animate-rise-in`}>
          {scene.isLastQuestion ? 'Final Question' : `Question ${scene.questionNumber} of ${scene.totalQuestions}`}
        </p>
        <h1 className={`${headline} font-black text-white drop-shadow-lg animate-slam-in`} style={{ animationDelay: '0.25s' }}>
          {scene.isLastQuestion ? '!!!' : `#${scene.questionNumber}`}
        </h1>
        {scene.category && (
          <span
            className={`${chip} rounded-full bg-white/20 border border-white/40 text-white font-semibold animate-rise-in`}
            style={{ animationDelay: '0.7s' }}
          >
            {scene.category}
          </span>
        )}
      </>
    )
  } else {
    backdrop = 'from-yellow-400 via-amber-600 to-purple-900'
    content = (
      <>
        <p className={`${subline} font-bold text-white/80 uppercase tracking-[0.3em] animate-rise-in`}>
          And the winner is...
        </p>
        <h1 className={`${headline} font-black text-white uppercase drop-shadow-lg animate-slam-in`} style={{ animationDelay: '0.4s' }}>
          Final Results
        </h1>
      </>
    )
  }

  return (
    <div className={`cut-scene bg-gradient-to-br ${backdrop} ${exiting ? 'is-exiting' : ''}`}>
      <div className="cut-scene-stripe" />
      <div className="relative flex flex-col items-center gap-6 text-center px-6">
        {content}
      </div>
    </div>
  )
}
