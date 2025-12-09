import { describe, it, expect, vi } from 'vitest'
import { seed, isSeedFunction, fixture } from '../../../src/edge-record/seed'

describe('seed()', () => {
  it('should mark function as a seed', async () => {
    const mockSeed = seed(async () => {
      // Mock seed implementation
    })

    expect(mockSeed.__isSeed).toBe(true)
  })

  it('should preserve async function behavior', async () => {
    let executed = false
    const mockSeed = seed(async () => {
      executed = true
    })

    await mockSeed()
    expect(executed).toBe(true)
  })

  it('should accept custom name option', () => {
    const mockSeed = seed(async () => {}, { name: 'test-seed' })
    expect(mockSeed.name).toBe('test-seed')
  })

  it('should accept environment option', () => {
    const mockSeed = seed(async () => {}, { environment: 'development' })
    expect(mockSeed.environment).toBe('development')
  })

  it('should accept multiple environments', () => {
    const mockSeed = seed(async () => {}, {
      environment: ['development', 'test'],
    })
    expect(mockSeed.environment).toEqual(['development', 'test'])
  })

  it('should accept dependencies option', () => {
    const mockSeed = seed(async () => {}, {
      dependencies: ['users', 'roles'],
    })
    expect(mockSeed.dependencies).toEqual(['users', 'roles'])
  })

  it('should handle all options together', () => {
    const mockSeed = seed(async () => {}, {
      name: 'advanced-seed',
      environment: ['development'],
      dependencies: ['base-seed'],
    })

    expect(mockSeed.name).toBe('advanced-seed')
    expect(mockSeed.environment).toEqual(['development'])
    expect(mockSeed.dependencies).toEqual(['base-seed'])
    expect(mockSeed.__isSeed).toBe(true)
  })
})

describe('isSeedFunction()', () => {
  it('should return true for seed functions', () => {
    const mockSeed = seed(async () => {})
    expect(isSeedFunction(mockSeed)).toBe(true)
  })

  it('should return false for regular functions', () => {
    const regularFn = async () => {}
    expect(isSeedFunction(regularFn)).toBe(false)
  })

  it('should return false for non-functions', () => {
    expect(isSeedFunction(null)).toBe(false)
    expect(isSeedFunction(undefined)).toBe(false)
    expect(isSeedFunction({})).toBe(false)
    expect(isSeedFunction('string')).toBe(false)
    expect(isSeedFunction(123)).toBe(false)
  })

  it('should return false for objects with __isSeed but not functions', () => {
    const fakeSeed = { __isSeed: true }
    expect(isSeedFunction(fakeSeed)).toBe(false)
  })
})

describe('fixture()', () => {
  it('should create a valid seed function', () => {
    const data = { users: [{ id: 1, name: 'Test' }] }
    const mockModel = { createMany: vi.fn().mockResolvedValue([]) }

    const fixtureSeed = fixture(data, { User: mockModel })

    expect(isSeedFunction(fixtureSeed)).toBe(true)
  })

  it('should execute fixture and call createMany', async () => {
    const data = {
      users: [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ],
    }
    const mockCreateMany = vi.fn().mockResolvedValue([{}, {}])
    const mockModel = { createMany: mockCreateMany }

    const fixtureSeed = fixture(data, { User: mockModel })
    await fixtureSeed()

    expect(mockCreateMany).toHaveBeenCalledWith([
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' },
    ])
  })

  it('should fall back to create when createMany not available', async () => {
    const data = { users: [{ id: 1 }] }
    const mockCreate = vi.fn().mockResolvedValue({})
    const mockModel = { create: mockCreate }

    const fixtureSeed = fixture(data, { User: mockModel })
    await fixtureSeed()

    expect(mockCreate).toHaveBeenCalledWith({ id: 1 })
  })

  it('should process tables in JSON key order', async () => {
    const data = {
      users: [{ id: 1 }],
      posts: [{ id: 1, userId: 1 }],
    }
    const insertOrder: string[] = []
    const models = {
      User: {
        createMany: vi.fn().mockImplementation(async () => {
          insertOrder.push('User')
          return []
        }),
      },
      Post: {
        createMany: vi.fn().mockImplementation(async () => {
          insertOrder.push('Post')
          return []
        }),
      },
    }

    const fixtureSeed = fixture(data, models)
    await fixtureSeed()

    expect(insertOrder).toEqual(['User', 'Post'])
  })

  it('should skip _meta key', async () => {
    const data = {
      _meta: { version: '1.0' },
      users: [{ id: 1 }],
    }
    const mockModel = { createMany: vi.fn().mockResolvedValue([]) }

    const fixtureSeed = fixture(data, { User: mockModel })
    await fixtureSeed()

    // Only users should be processed, not _meta
    expect(mockModel.createMany).toHaveBeenCalledTimes(1)
  })

  it('should throw for missing model', async () => {
    const data = { users: [{ id: 1 }] }

    const fixtureSeed = fixture(data, {})

    await expect(fixtureSeed()).rejects.toThrow('Model "User" not found')
  })

  it('should throw for model without create methods', async () => {
    const data = { users: [{ id: 1 }] }

    const fixtureSeed = fixture(data, { User: {} })

    await expect(fixtureSeed()).rejects.toThrow('must have createMany or create')
  })

  it('should support custom tableToModel function', async () => {
    const data = { tbl_users: [{ id: 1 }] }
    const mockModel = { createMany: vi.fn().mockResolvedValue([]) }

    const fixtureSeed = fixture(
      data,
      { UserModel: mockModel },
      {
        // tbl_users -> users -> Users -> UsersModel -> UserModel
        tableToModel: (name) => {
          const base = name.replace('tbl_', '')
          const pascal = base.charAt(0).toUpperCase() + base.slice(1)
          // Remove trailing 's' and add 'Model'
          return pascal.slice(0, -1) + 'Model'
        },
      }
    )
    await fixtureSeed()

    expect(mockModel.createMany).toHaveBeenCalled()
  })

  it('should inherit seed options', () => {
    const data = { users: [] }

    const fixtureSeed = fixture(
      data,
      {},
      {
        name: 'my-fixture',
        environment: 'test',
        dependencies: ['other-seed'],
      }
    )

    expect(fixtureSeed.name).toBe('my-fixture')
    expect(fixtureSeed.environment).toBe('test')
    expect(fixtureSeed.dependencies).toEqual(['other-seed'])
  })

  it('should convert plural table names correctly', async () => {
    const data = {
      users: [{ id: 1 }],
      categories: [{ id: 1 }],
      addresses: [{ id: 1 }],
      lives: [{ id: 1 }],
    }
    const models = {
      User: { createMany: vi.fn().mockResolvedValue([]) },
      Category: { createMany: vi.fn().mockResolvedValue([]) },
      Address: { createMany: vi.fn().mockResolvedValue([]) },
      Life: { createMany: vi.fn().mockResolvedValue([]) },
    }

    const fixtureSeed = fixture(data, models)
    await fixtureSeed()

    expect(models.User.createMany).toHaveBeenCalled()
    expect(models.Category.createMany).toHaveBeenCalled()
    expect(models.Address.createMany).toHaveBeenCalled()
    expect(models.Life.createMany).toHaveBeenCalled()
  })

  it('should skip empty tables', async () => {
    const data = { users: [] }
    const mockModel = { createMany: vi.fn() }

    const fixtureSeed = fixture(data, { User: mockModel })
    await fixtureSeed()

    expect(mockModel.createMany).not.toHaveBeenCalled()
  })
})
