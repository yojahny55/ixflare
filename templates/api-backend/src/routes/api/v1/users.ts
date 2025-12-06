/**
 * Users API Endpoint
 * Demonstrates RESTful API patterns with Zod validation
 */
import type { RouteContext } from '@/types'
import { UserService } from '@/services/user-service'
import { createUserSchema, updateUserSchema, userQuerySchema } from '@/schemas/user'

export async function GET(ctx: RouteContext) {
  const url = new URL(ctx.request.url)

  // Parse query parameters
  const queryResult = userQuerySchema.safeParse({
    page: url.searchParams.get('page'),
    limit: url.searchParams.get('limit'),
    search: url.searchParams.get('search'),
    sortBy: url.searchParams.get('sortBy'),
    sortOrder: url.searchParams.get('sortOrder'),
  })

  if (!queryResult.success) {
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: queryResult.error.flatten(),
        },
      },
      { status: 422 }
    )
  }

  const userService = new UserService(ctx.env)
  const users = await userService.findAll(queryResult.data)

  return Response.json(users)
}

export async function POST(ctx: RouteContext) {
  let body: unknown
  try {
    body = await ctx.request.json()
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }

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

  const userService = new UserService(ctx.env)
  const user = await userService.create(result.data)

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

  let body: unknown
  try {
    body = await ctx.request.json()
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }

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

  const userService = new UserService(ctx.env)
  const user = await userService.update(id, result.data)

  if (!user) {
    return Response.json(
      { error: { code: 'NOT_FOUND', message: `User ${id} not found` } },
      { status: 404 }
    )
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

  const userService = new UserService(ctx.env)
  const deleted = await userService.delete(id)

  if (!deleted) {
    return Response.json(
      { error: { code: 'NOT_FOUND', message: `User ${id} not found` } },
      { status: 404 }
    )
  }

  return Response.json({ success: true, deletedId: id })
}
