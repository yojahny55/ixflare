/**
 * Health Check Endpoint
 * Provides status information for monitoring and load balancers
 */
import type { RouteContext } from '@/types'

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down'
  timestamp: number
  version: string
  uptime: number
  checks: {
    database?: 'ok' | 'error'
    cache?: 'ok' | 'error'
  }
}

// Track server start time for uptime calculation
const startTime = Date.now()

export async function GET(ctx: RouteContext): Promise<Response> {
  const checks: HealthStatus['checks'] = {}

  // Check database connectivity (if configured)
  if (ctx.env.DB) {
    try {
      // Simple query to verify database connection
      await ctx.env.DB.prepare('SELECT 1').first()
      checks.database = 'ok'
    } catch {
      checks.database = 'error'
    }
  }

  // Check cache connectivity (if configured)
  if (ctx.env.CACHE) {
    try {
      // Simple operation to verify cache connection
      await ctx.env.CACHE.get('__health_check__')
      checks.cache = 'ok'
    } catch {
      checks.cache = 'error'
    }
  }

  // Determine overall status
  const hasErrors = Object.values(checks).some((status) => status === 'error')
  const status: HealthStatus['status'] = hasErrors ? 'degraded' : 'ok'

  const healthStatus: HealthStatus = {
    status,
    timestamp: Date.now(),
    version: '0.0.1',
    uptime: Date.now() - startTime,
    checks,
  }

  return Response.json(healthStatus, {
    status: status === 'ok' ? 200 : 503,
  })
}
