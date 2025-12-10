/**
 * Pagination types and interfaces for EdgeRecord ORM
 *
 * Supports both offset-based and cursor-based pagination strategies.
 */

/**
 * Maximum number of records allowed per page to prevent abuse
 * @constant
 */
export const MAX_PAGE_SIZE = 100

/**
 * Default page size when not specified
 * @constant
 */
export const DEFAULT_PAGE_SIZE = 20

/**
 * Options for offset-based pagination
 */
export interface PaginationOptions {
  /**
   * Page number (1-indexed)
   */
  page: number

  /**
   * Number of records per page
   * Will be capped at MAX_PAGE_SIZE if exceeded
   * @default 20
   */
  perPage?: number
}

/**
 * Metadata returned with offset-based pagination
 */
export interface PaginationMeta {
  /**
   * Total number of records matching the query
   */
  total: number

  /**
   * Number of records per page
   */
  perPage: number

  /**
   * Current page number (1-indexed)
   */
  currentPage: number

  /**
   * Last page number
   */
  lastPage: number

  /**
   * Index of first record on current page (1-indexed, 0 if empty)
   */
  from: number

  /**
   * Index of last record on current page (1-indexed)
   */
  to: number
}

/**
 * Pagination links for navigation
 */
export interface PaginationLinks {
  /**
   * Query string for first page
   */
  first: string

  /**
   * Query string for previous page (null if on first page)
   */
  prev: string | null

  /**
   * Query string for next page (null if on last page)
   */
  next: string | null

  /**
   * Query string for last page
   */
  last: string
}

/**
 * Result returned from offset-based pagination
 */
export interface PaginatedResult<T> {
  /**
   * Array of paginated records
   */
  data: T[]

  /**
   * Pagination metadata
   */
  meta: PaginationMeta

  /**
   * Navigation links
   */
  links: PaginationLinks
}

/**
 * Options for cursor-based pagination
 */
export interface CursorPaginationOptions {
  /**
   * Base64-encoded cursor from previous page
   * Omit to fetch first page
   */
  cursor?: string

  /**
   * Maximum number of records to return
   * Will be capped at MAX_PAGE_SIZE if exceeded
   * @default 20
   */
  limit?: number
}

/**
 * Metadata returned with cursor-based pagination
 */
export interface CursorPaginationMeta {
  /**
   * Whether more records exist after current page
   */
  hasMore: boolean

  /**
   * Cursor for fetching next page (null if no more records)
   */
  nextCursor: string | null

  /**
   * Cursor for fetching previous page (null if on first page)
   */
  prevCursor: string | null
}

/**
 * Result returned from cursor-based pagination
 */
export interface CursorPaginatedResult<T> {
  /**
   * Array of paginated records
   */
  data: T[]

  /**
   * Cursor pagination metadata
   */
  meta: CursorPaginationMeta
}

/**
 * Internal cursor structure (before encoding)
 */
export interface Cursor {
  /**
   * Value of the ordered column
   */
  [orderField: string]: unknown

  /**
   * ID value for tie-breaking
   */
  id: number | string
}
