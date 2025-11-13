/**
 * Scoring system for the trivia game
 */

export interface ScoringConfig {
  basePoints: number
  speedBonusPerSecond: number
  streakBonus: number
  streakThreshold: number
}

export const defaultScoringConfig: ScoringConfig = {
  basePoints: 100,
  speedBonusPerSecond: 10,
  streakBonus: 50,
  streakThreshold: 3,
}

/**
 * Calculate points for a correct answer
 */
export function calculatePoints(
  timeTakenMs: number,
  timeLimit: number,
  consecutiveCorrect: number = 0,
  config: ScoringConfig = defaultScoringConfig
): number {
  let points = config.basePoints

  // Speed bonus (10 points per second remaining)
  const secondsTaken = Math.ceil(timeTakenMs / 1000)
  const secondsRemaining = Math.max(0, timeLimit - secondsTaken)
  points += secondsRemaining * config.speedBonusPerSecond

  // Streak bonus (50 points for 3+ correct in a row)
  if (consecutiveCorrect >= config.streakThreshold) {
    points += config.streakBonus
  }

  return points
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  return score.toLocaleString()
}

/**
 * Get rank emoji based on position
 */
export function getRankEmoji(position: number): string {
  switch (position) {
    case 1:
      return '🥇'
    case 2:
      return '🥈'
    case 3:
      return '🥉'
    default:
      return `${position}th`
  }
}

/**
 * Calculate percentage of correct answers
 */
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 0
  return Math.round((correct / total) * 100)
}