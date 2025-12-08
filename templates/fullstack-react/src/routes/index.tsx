/**
 * Root SSR Page Component
 * Demonstrates server-side rendering with React at the edge
 */
import type { RouteContext } from '@/types'

interface PageProps {
  title: string
  timestamp: number
}

export async function loader(ctx: RouteContext): Promise<PageProps> {
  return {
    title: '{{projectName}}',
    timestamp: Date.now(),
  }
}

export default function HomePage({ title, timestamp }: PageProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="stylesheet" href="/src/index.css" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <main className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to {title}</h1>
          <p className="text-gray-600 mb-8">
            Your Ixflare fullstack application is running at the edge.
          </p>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Server-Side Rendered</h2>
            <p className="text-gray-500">
              This page was rendered on the server at{' '}
              <time dateTime={new Date(timestamp).toISOString()}>
                {new Date(timestamp).toLocaleString()}
              </time>
            </p>
          </div>
        </main>
        <script type="module" src="/src/main.tsx" />
      </body>
    </html>
  )
}
