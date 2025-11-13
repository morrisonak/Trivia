// Custom server entry for Cloudflare Workers
// This wraps the TanStack Start handler and exposes Cloudflare bindings properly

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    // Import the TanStack Start handler dynamically
    const { default: handler } = await import('@tanstack/react-start/server-entry')

    // Call the handler with modified request that includes env in context
    // @ts-expect-error - Augmenting request with Cloudflare env
    request.env = env

    return handler.fetch(request, env, ctx)
  },
}
