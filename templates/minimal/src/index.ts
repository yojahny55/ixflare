/**
 * {{projectNamePascal}} - Ixflare Application
 *
 * This is the entry point for your Cloudflare Worker.
 */

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Example route handling
    if (url.pathname === '/') {
      return new Response('Hello from {{projectName}}!', {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    if (url.pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        timestamp: Date.now(),
      })
    }

    return new Response('Not Found', { status: 404 })
  },
}

// Type definitions for Cloudflare bindings
interface Env {
  // Add your bindings here, e.g.:
  // DB: D1Database
  // CACHE: KVNamespace
}
