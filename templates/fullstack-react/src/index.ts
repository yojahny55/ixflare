/**
 * {{projectNamePascal}} - Fullstack React Application
 *
 * This is the entry point for your Cloudflare Worker.
 */

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, url, env)
    }

    // Serve React app for all other routes
    return new Response(getHtmlTemplate(), {
      headers: { 'Content-Type': 'text/html' },
    })
  },
}

async function handleApi(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === '/api/health') {
    return Response.json({
      status: 'ok',
      timestamp: Date.now(),
    })
  }

  return Response.json(
    { error: { code: 'NOT_FOUND', message: 'API endpoint not found' } },
    { status: 404 }
  )
}

function getHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{projectName}}</title>
  <script type="module" src="/src/main.tsx"></script>
  <link rel="stylesheet" href="/src/index.css">
</head>
<body>
  <div id="root"></div>
</body>
</html>`
}

// Type definitions for Cloudflare bindings
interface Env {
  // Add your bindings here, e.g.:
  // DB: D1Database
  // CACHE: KVNamespace
}
