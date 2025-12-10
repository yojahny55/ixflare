/**
 * @module edge-record/consistency
 * @description Multi-tier data consistency management for EdgeRecord
 */

export * from './types'
export { StrongConsistencyAdapter } from './strong-adapter'
export { EventualConsistencyAdapter, type SyncStatus } from './eventual-adapter'
export { ConsistencyCoordinator } from './coordinator'
