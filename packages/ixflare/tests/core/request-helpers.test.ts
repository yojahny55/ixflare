import { describe, it, expect } from 'vitest'
import {
  cloneRequest,
  cloneResponse,
  withRequestHeaders,
  withResponseHeaders,
} from '@/core/request-helpers'

describe('cloneRequest', () => {
  it('should create a new request with same properties', () => {
    const original = new Request('https://example.com/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jordan' }),
    })

    const cloned = cloneRequest(original)

    expect(cloned.url).toBe('https://example.com/api/users')
    expect(cloned.method).toBe('POST')
    expect(cloned.headers.get('Content-Type')).toBe('application/json')
  })

  it('should have mutable headers on cloned request', () => {
    const original = new Request('https://example.com/', {
      headers: { 'X-Original': 'value' },
    })

    const cloned = cloneRequest(original)
    cloned.headers.set('X-Custom', 'new-value')

    expect(cloned.headers.get('X-Custom')).toBe('new-value')
    expect(cloned.headers.get('X-Original')).toBe('value')
  })

  it('should allow overriding properties via init', () => {
    const original = new Request('https://example.com/', {
      method: 'GET',
    })

    const cloned = cloneRequest(original, {
      method: 'POST',
      headers: { 'X-Override': 'true' },
    })

    expect(cloned.method).toBe('POST')
    expect(cloned.headers.get('X-Override')).toBe('true')
  })

  it('should preserve body when cloning', async () => {
    const body = JSON.stringify({ data: 'test' })
    const original = new Request('https://example.com/', {
      method: 'POST',
      body,
    })

    const cloned = cloneRequest(original)
    const clonedBody = await cloned.text()

    expect(clonedBody).toBe(body)
  })
})

describe('cloneResponse', () => {
  it('should create a new response with same properties', async () => {
    const original = new Response('Hello World', {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'text/plain' },
    })

    const cloned = cloneResponse(original)

    expect(cloned.status).toBe(200)
    expect(cloned.statusText).toBe('OK')
    expect(cloned.headers.get('Content-Type')).toBe('text/plain')
    expect(await cloned.text()).toBe('Hello World')
  })

  it('should have mutable headers on cloned response', () => {
    const original = new Response('test', {
      headers: { 'X-Original': 'value' },
    })

    const cloned = cloneResponse(original)
    cloned.headers.set('X-Custom', 'new-value')

    expect(cloned.headers.get('X-Custom')).toBe('new-value')
    expect(cloned.headers.get('X-Original')).toBe('value')
  })

  it('should allow overriding status via init', () => {
    const original = new Response('test', { status: 200 })

    const cloned = cloneResponse(original, { status: 201 })

    expect(cloned.status).toBe(201)
  })

  it('should allow overriding headers via init', () => {
    const original = new Response('test', {
      headers: { 'X-Original': 'value' },
    })

    const cloned = cloneResponse(original, {
      headers: { 'X-Override': 'new' },
    })

    expect(cloned.headers.get('X-Override')).toBe('new')
    expect(cloned.headers.get('X-Original')).toBeNull()
  })

  it('should preserve body when cloning', async () => {
    const body = JSON.stringify({ data: 'test' })
    const original = new Response(body, {
      headers: { 'Content-Type': 'application/json' },
    })

    const cloned = cloneResponse(original)
    const clonedBody = await cloned.text()

    expect(clonedBody).toBe(body)
  })
})

describe('withRequestHeaders', () => {
  it('should add new headers to request', () => {
    const original = new Request('https://example.com/')

    const modified = withRequestHeaders(original, {
      'X-Custom': 'value',
      'X-Another': 'header',
    })

    expect(modified.headers.get('X-Custom')).toBe('value')
    expect(modified.headers.get('X-Another')).toBe('header')
  })

  it('should override existing headers', () => {
    const original = new Request('https://example.com/', {
      headers: { 'Content-Type': 'text/plain' },
    })

    const modified = withRequestHeaders(original, {
      'Content-Type': 'application/json',
    })

    expect(modified.headers.get('Content-Type')).toBe('application/json')
  })

  it('should preserve other request properties', () => {
    const original = new Request('https://example.com/api', {
      method: 'POST',
    })

    const modified = withRequestHeaders(original, {
      'X-Custom': 'value',
    })

    expect(modified.url).toBe('https://example.com/api')
    expect(modified.method).toBe('POST')
  })

  it('should not mutate original request', () => {
    const original = new Request('https://example.com/', {
      headers: { 'X-Original': 'value' },
    })

    const modified = withRequestHeaders(original, {
      'X-New': 'header',
    })

    expect(original.headers.get('X-New')).toBeNull()
    expect(modified.headers.get('X-New')).toBe('header')
  })

  it('should preserve body when adding headers', async () => {
    const body = JSON.stringify({ data: 'test' })
    const original = new Request('https://example.com/', {
      method: 'POST',
      body,
    })

    const modified = withRequestHeaders(original, {
      'X-Custom': 'value',
    })

    const modifiedBody = await modified.text()
    expect(modifiedBody).toBe(body)
  })
})

describe('withResponseHeaders', () => {
  it('should add new headers to response', () => {
    const original = new Response('test')

    const modified = withResponseHeaders(original, {
      'X-Response-Time': '45ms',
      'X-Request-ID': '12345',
    })

    expect(modified.headers.get('X-Response-Time')).toBe('45ms')
    expect(modified.headers.get('X-Request-ID')).toBe('12345')
  })

  it('should override existing headers', () => {
    const original = new Response('test', {
      headers: { 'Content-Type': 'text/plain' },
    })

    const modified = withResponseHeaders(original, {
      'Content-Type': 'application/json',
    })

    expect(modified.headers.get('Content-Type')).toBe('application/json')
  })

  it('should preserve other response properties', () => {
    const original = new Response('test', {
      status: 201,
      statusText: 'Created',
    })

    const modified = withResponseHeaders(original, {
      'X-Custom': 'value',
    })

    expect(modified.status).toBe(201)
    expect(modified.statusText).toBe('Created')
  })

  it('should not mutate original response', () => {
    const original = new Response('test', {
      headers: { 'X-Original': 'value' },
    })

    const modified = withResponseHeaders(original, {
      'X-New': 'header',
    })

    expect(original.headers.get('X-New')).toBeNull()
    expect(modified.headers.get('X-New')).toBe('header')
  })

  it('should preserve body when adding headers', async () => {
    const body = JSON.stringify({ data: 'test' })
    const original = new Response(body)

    const modified = withResponseHeaders(original, {
      'X-Custom': 'value',
    })

    const modifiedBody = await modified.text()
    expect(modifiedBody).toBe(body)
  })
})
