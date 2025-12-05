/**
 * Users API Endpoint
 * Demonstrates RESTful API patterns with Zod validation
 */
import { z } from 'zod'
import type { RouteContext } from '@/types'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
})

const updateUserSchema = createUserSchema.partial()

export async function GET(ctx: RouteContext) {
  // Return users list
  // In production, replace with actual database query
  return Response.json([
    { id: '1', email: 'alice@example.com', name: 'Alice', createdAt: Date.now() },
    { id: '2', email: 'bob@example.com', name: 'Bob', createdAt: Date.now() },
  ])
}

export async function POST(ctx: RouteContext) {
  const body = await ctx.request.json()
  const result = createUserSchema.safeParse(body)

  if (!result.success) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.message,
          details: result.error.flatten(),
        },
      },
      { status: 422 }
    )
  }

  // Create user logic here
  // In production, replace with actual database insert
  const user = {
    id: crypto.randomUUID(),
    ...result.data,
    createdAt: Date.now(),
  }

  return Response.json(user, { status: 201 })
}

export async function PUT(ctx: RouteContext) {
  const url = new URL(ctx.request.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'User ID is required' } },
      { status: 422 }
    )
  }

  const body = await ctx.request.json()
  const result = updateUserSchema.safeParse(body)

  if (!result.success) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.message,
          details: result.error.flatten(),
        },
      },
      { status: 422 }
    )
  }

  // Update user logic here
  // In production, replace with actual database update
  const user = {
    id,
    email: result.data.email ?? 'existing@example.com',
    name: result.data.name ?? 'Existing User',
    updatedAt: Date.now(),
  }

  return Response.json(user)
}

export async function DELETE(ctx: RouteContext) {
  const url = new URL(ctx.request.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'User ID is required' } },
      { status: 422 }
    )
  }

  // Delete user logic here
  // In production, replace with actual database delete
  return Response.json({ success: true, deletedId: id })
}
