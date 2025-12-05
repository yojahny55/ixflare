// Import URLPattern polyfill for Node.js test environment
import 'urlpattern-polyfill'

import { describe, it, expect } from 'vitest'
import { Router, createRouter } from '../../src/core/router'

describe('Router', () => {
  it('should create a new router instance', () => {
    const router = createRouter()
    expect(router).toBeInstanceOf(Router)
  })

  it('should add routes and match them', async () => {
    const router = createRouter()

    router.add('/users', ({ request }) => {
      return new Response('users list')
    })

    const request = new Request('http://localhost/users')
    const response = await router.handle(request, {})

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('users list')
  })

  it('should extract route params', async () => {
    const router = createRouter()
    let capturedParams: Record<string, string | string[]> = {}

    router.add('/users/:id', ({ params }) => {
      capturedParams = params
      return new Response('user detail')
    })

    const request = new Request('http://localhost/users/123')
    await router.handle(request, {})

    expect(capturedParams.id).toBe('123')
  })

  it('should return 404 for unmatched routes', async () => {
    const router = createRouter()

    const request = new Request('http://localhost/unknown')
    const response = await router.handle(request, {})

    expect(response.status).toBe(404)
  })
})
