import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'

import * as schema from './schema.ts'

// Create a Drizzle client from a D1 database binding
// The D1 binding is passed from the Cloudflare context in server functions
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

// Export schema for use in queries
export { schema }
