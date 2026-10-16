import { describe, expect, it } from 'vitest'
import {
  calculateAccuracy,
  calculatePoints,
  defaultScoringConfig,
  formatScore,
  getRankEmoji,
} from './scoring'

describe('calculatePoints', () => {
  it('awards base points for a correct answer with no time remaining', () => {
    // 15s taken of a 15s limit: no speed bonus
    expect(calculatePoints(15000, 15)).toBe(defaultScoringConfig.basePoints)
  })

  it('awards 10 points per second remaining', () => {
    // 5s taken: 10 seconds remain
    expect(calculatePoints(5000, 15)).toBe(100 + 10 * 10)
  })

  it('rounds partial seconds up against the player', () => {
    // 4.2s taken counts as 5s: 10 seconds remain
    expect(calculatePoints(4200, 15)).toBe(100 + 10 * 10)
  })

  it('answers at 0ms get the full speed bonus', () => {
    expect(calculatePoints(0, 15)).toBe(100 + 15 * 10)
  })

  it('adds the streak bonus at the threshold', () => {
    const base = calculatePoints(15000, 15, 2)
    const streak = calculatePoints(15000, 15, 3)
    expect(base).toBe(defaultScoringConfig.basePoints)
    expect(streak).toBe(defaultScoringConfig.basePoints + defaultScoringConfig.streakBonus)
  })

  it('keeps the streak bonus beyond the threshold', () => {
    expect(calculatePoints(15000, 15, 7)).toBe(
      defaultScoringConfig.basePoints + defaultScoringConfig.streakBonus
    )
  })

  it('never produces a negative speed bonus for overlong times', () => {
    expect(calculatePoints(99999, 15)).toBe(defaultScoringConfig.basePoints)
  })
})

describe('calculateAccuracy', () => {
  it('returns 0 for no answers', () => {
    expect(calculateAccuracy(0, 0)).toBe(0)
  })

  it('rounds to a whole percentage', () => {
    expect(calculateAccuracy(2, 3)).toBe(67)
    expect(calculateAccuracy(5, 5)).toBe(100)
  })
})

describe('formatScore', () => {
  it('adds thousands separators', () => {
    expect(formatScore(1250)).toBe((1250).toLocaleString())
  })
})

describe('getRankEmoji', () => {
  it('gives medals for the top three', () => {
    expect(getRankEmoji(1)).toBe('🥇')
    expect(getRankEmoji(2)).toBe('🥈')
    expect(getRankEmoji(3)).toBe('🥉')
  })

  it('falls back to ordinal text', () => {
    expect(getRankEmoji(4)).toBe('4th')
  })
})
