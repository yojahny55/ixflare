/**
 * {{projectNamePascal}} - API Backend
 *
 * This is the entry point for your Cloudflare Worker API.
 */

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        timestamp: Date.now(),
      })
    }

    // API v1 routes
    if (url.pathname.startsWith('/api/v1/')) {
      return handleApiV1(request, url, env)
    }

    // Root endpoint
    if (url.pathname === '/') {
      return Response.json({
        name: '{{projectName}}',
        version: '0.0.1',
        docs: '/api/health',
      })
    }

    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
      { status: 404 }
    )
  },
}

async function handleApiV1(request: Request, url: URL, env: Env): Promise<Response> {
  const path = url.pathname.replace('/api/v1', '')

  // Users endpoint example
  if (path === '/users') {
    if (request.method === 'GET') {
      return Response.json({
        users: [
          { id: 1, name: 'Alice', createdAt: Date.now() },
          { id: 2, name: 'Bob', createdAt: Date.now() },
        ],
      })
    }

    if (request.method === 'POST') {
      const body = (await request.json()) as { name?: string }
      if (!body.name) {
        return Response.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
          { status: 422 }
        )
      }
      return Response.json({ id: 3, name: body.name, createdAt: Date.now() }, { status: 201 })
    }
  }

  return Response.json(
    { error: { code: 'NOT_FOUND', message: 'API endpoint not found' } },
    { status: 404 }
  )
}

// Type definitions for Cloudflare bindings
interface Env {
  // Add your bindings here, e.g.:
  // DB: D1Database
  // CACHE: KVNamespace
}
