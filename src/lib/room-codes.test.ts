import { describe, expect, it } from 'vitest'
import { formatRoomCode, generateRoomCode, isValidRoomCode } from './room-codes'

describe('generateRoomCode', () => {
  it('produces 4-character codes', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toHaveLength(4)
    }
  })

  it('never uses ambiguous characters (0, O, 1, I, L)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).not.toMatch(/[0O1IL]/)
    }
  })

  it('always passes its own validator', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidRoomCode(generateRoomCode())).toBe(true)
    }
  })
})

describe('isValidRoomCode', () => {
  it('accepts 4 uppercase alphanumerics', () => {
    expect(isValidRoomCode('AB12')).toBe(true)
  })

  it('rejects wrong lengths, lowercase, and symbols', () => {
    expect(isValidRoomCode('ABC')).toBe(false)
    expect(isValidRoomCode('ABCDE')).toBe(false)
    expect(isValidRoomCode('ab12')).toBe(false)
    expect(isValidRoomCode('AB 1')).toBe(false)
    expect(isValidRoomCode('')).toBe(false)
  })
})

describe('formatRoomCode', () => {
  it('splits a 4-character code into pairs', () => {
    expect(formatRoomCode('AB12')).toBe('AB 12')
  })

  it('leaves other lengths untouched', () => {
    expect(formatRoomCode('ABC')).toBe('ABC')
    expect(formatRoomCode('ABCDE')).toBe('ABCDE')
  })
})
