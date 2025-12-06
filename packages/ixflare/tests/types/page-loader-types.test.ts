/**
 * @fileoverview Type inference tests for PageProps and PageLoaderFunction
 */

import { describe, it, expect } from 'vitest'
import type { PageProps, PageLoaderFunction, LoaderArgs } from '../../src/types/handlers'

describe('PageLoaderFunction type inference', () => {
  it('should infer data type from loader return value', () => {
    // Define a loader that returns specific data structure
    const loader: PageLoaderFunction<{ user: { id: string; name: string } }> = async ({
      params,
    }: LoaderArgs) => {
      return {
        user: {
          id: params.userId || '1',
          name: 'Test User',
        },
      }
    }

    // Type check - this should compile without errors
    const result = loader({ params: { userId: '123' } } as LoaderArgs)
    expect(result).toBeDefined()
  })

  it('should allow loader to return Response directly', () => {
    const loader: PageLoaderFunction<{ user: { id: string } }> = async () => {
      // Can return Response (e.g., redirect)
      return new Response(null, {
        status: 302,
        headers: { Location: '/login' },
      })
    }

    const result = loader({ params: {} } as LoaderArgs)
    expect(result).toBeDefined()
  })

  it('should allow both sync and async loaders', () => {
    // Sync loader
    const syncLoader: PageLoaderFunction<{ count: number }> = () => {
      return { count: 42 }
    }

    // Async loader
    const asyncLoader: PageLoaderFunction<{ count: number }> = async () => {
      return { count: 42 }
    }

    expect(syncLoader({ params: {} } as LoaderArgs)).toEqual({ count: 42 })
    expect(asyncLoader({ params: {} } as LoaderArgs)).toBeDefined()
  })
})

describe('PageProps type inference', () => {
  it('should correctly type data prop from loader return type', () => {
    interface UserData {
      user: {
        id: string
        name: string
        email: string
      }
    }

    // Component expects UserData
    function UserPage({ data, params, request }: PageProps<UserData>) {
      // data.user should be correctly typed
      const userId: string = data.user.id
      const userName: string = data.user.name
      const userEmail: string = data.user.email

      expect(userId).toBeDefined()
      expect(userName).toBeDefined()
      expect(userEmail).toBeDefined()
      expect(params).toBeDefined()
      expect(request).toBeDefined()

      return null
    }

    // This should type-check correctly
    const mockProps: PageProps<UserData> = {
      data: {
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
        },
      },
      params: { userId: '1' },
      request: new Request('http://localhost/users/1'),
    }

    UserPage(mockProps)
  })

  it('should require all PageProps fields', () => {
    const props: PageProps<{ count: number }> = {
      data: { count: 10 },
      params: { id: '1' },
      request: new Request('http://localhost/test'),
    }

    expect(props.data.count).toBe(10)
    expect(props.params.id).toBe('1')
    expect(props.request).toBeInstanceOf(Request)
  })
})

describe('Loader to PageProps type flow', () => {
  it('should maintain type safety from loader to component', async () => {
    // Define data structure
    interface PostData {
      post: {
        id: string
        title: string
        content: string
      }
    }

    // Define loader with typed return
    const loader: PageLoaderFunction<PostData> = async ({ params }: LoaderArgs) => {
      return {
        post: {
          id: params.postId || '1',
          title: 'Test Post',
          content: 'Test content',
        },
      }
    }

    // Simulate loader execution
    const loaderResult = await loader({
      params: { postId: '123' },
    } as LoaderArgs)

    // If loader returned data (not Response), it should match PostData
    if (!(loaderResult instanceof Response)) {
      const pageProps: PageProps<PostData> = {
        data: loaderResult,
        params: { postId: '123' },
        request: new Request('http://localhost/posts/123'),
      }

      // Type inference should work correctly
      expect(pageProps.data.post.id).toBe('123')
      expect(pageProps.data.post.title).toBe('Test Post')
    }
  })
})
