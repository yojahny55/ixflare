/**
 * Root Route Handler
 * Demonstrates the basic routing pattern for Ixflare
 */
import type { RouteContext } from '@/types'

/**
 * GET handler for the root route
 * Returns a simple welcome message
 */
export async function GET(ctx: RouteContext): Promise<Response> {
  return new Response('Hello from {{projectName}}!', {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}

/**
 * POST handler for the root route
 * Echoes the request body
 */
export async function POST(ctx: RouteContext): Promise<Response> {
  const body = await ctx.request.text()

  return Response.json({
    message: 'Received your data',
    echo: body,
    timestamp: Date.now(),
  })
}
