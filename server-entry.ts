// Custom server entry for Cloudflare Workers
// This wraps the TanStack Start handler and exposes Cloudflare bindings properly

export { GameRoom } from './src/durable-objects/GameRoom'

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // Handle WebSocket upgrade requests for game rooms
    // Must handle BEFORE TanStack Router because WebSocket upgrades need special handling
    if (url.pathname.match(/^\/api\/games\/[A-Z0-9]+\/ws$/)) {
      const upgradeHeader = request.headers.get('Upgrade')
      if (upgradeHeader === 'websocket') {
        // Extract room code from URL: /api/games/ABCD/ws
        const roomCode = url.pathname.split('/')[3]
        const playerId = url.searchParams.get('playerId')

        if (!playerId) {
          return new Response('Missing playerId parameter', { status: 400 })
        }

        if (!env.GAME_ROOM) {
          return new Response('Durable Object binding not found', { status: 500 })
        }

        // Get the Durable Object stub for this room
        const id = env.GAME_ROOM.idFromName(roomCode.toUpperCase())
        const stub = env.GAME_ROOM.get(id)

        // Forward the WebSocket upgrade request to the Durable Object
        const wsUrl = `https://fake-host/ws?playerId=${playerId}`
        return stub.fetch(new Request(wsUrl, { headers: request.headers }))
      }
    }

    // Import the TanStack Start handler dynamically
    const { default: handler } = await import('@tanstack/react-start/server-entry')

    // Call the handler with modified request that includes env in context
    // @ts-expect-error - Augmenting request with Cloudflare env
    request.env = env

    return handler.fetch(request, env, ctx)
  },
}
