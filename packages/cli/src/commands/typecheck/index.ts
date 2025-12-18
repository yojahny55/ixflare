// Core type checking functionality
export { typeCheck } from './checker.js'
export { typeCheckWatch } from './watch.js'

// Configuration
export { findTsConfig, loadTsConfig } from './config.js'

// Formatting
export {
	formatDiagnostics,
	formatDiagnosticsPretty,
	formatDiagnosticsCI,
	createFormatHost,
} from './formatter.js'

// Types
export type {
	TypeCheckOptions,
	TypeCheckResult,
	FormatDiagnosticsHost,
} from './types.js'
