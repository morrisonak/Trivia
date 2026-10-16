/// <reference types="@cloudflare/workers-types" />

import type { GameRoom } from './durable-objects/GameRoom'
import type { D1Database } from '@cloudflare/workers-types'

declare module 'cloudflare:workers' {
  export interface Env {
    // D1 Database binding
    DB: D1Database

    // Durable Object bindings
    GAME_ROOM: DurableObjectNamespace<GameRoom>
  }
}

// Augment Request to include env (injected by server-entry.ts)
declare global {
  interface Request {
    env?: {
      DB: D1Database
      GAME_ROOM: DurableObjectNamespace<GameRoom>
    }
  }
}
