/**
 * Generate a random 4-character room code
 * Uses uppercase letters and numbers, avoiding ambiguous characters
 */
export function generateRoomCode(): string {
  // Avoid ambiguous characters: 0/O, 1/I/L
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return code
}

/**
 * Validate room code format
 */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4}$/.test(code)
}

/**
 * Format room code for display (adds spacing)
 */
export function formatRoomCode(code: string): string {
  if (code.length !== 4) return code
  return `${code.slice(0, 2)} ${code.slice(2, 4)}`
}