/**
 * @module edge-record/transaction
 * @description Transaction support for EdgeRecord ORM
 * @packageDocumentation
 */

export { transaction } from './transaction'
export type {
  TransactionContext,
  TransactionOptions,
  TransactionUpdateInput,
  IsolationLevel,
  UpdateOperators,
  ModifiedRecord,
} from './types'
export { TransactionContextImpl } from './context'
export {
  generateSavepointName,
  createSavepointSQL,
  releaseSavepointSQL,
  rollbackToSavepointSQL,
  SavepointManager,
} from './savepoint'
