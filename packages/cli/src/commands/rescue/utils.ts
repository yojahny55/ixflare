/**
 * @module commands/rescue/utils
 * @description Shared utilities for rescue checkpoint operations
 * @node-only
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

/**
 * Checkpoint metadata schema
 */
export interface CheckpointMetadata {
  id: string
  name?: string
  description?: string
  timestamp: number
  components: {
    d1?: {
      binding: string
      file: string
      tables: number
    }
    kv?: {
      binding: string
      file: string
      keys: number
    }
    git?: {
      stashRef: string
      branch: string
      commitHash: string
    }
  }
}

/**
 * Checkpoint storage directory name
 */
export const RESCUE_DIR_NAME = '.ixflare/rescue'

/**
 * Get the rescue checkpoints directory path
 *
 * @param cwd Current working directory
 * @returns Path to rescue directory
 */
export function getRescueDir(cwd: string): string {
  return join(cwd, RESCUE_DIR_NAME)
}

/**
 * Ensure the rescue directory exists
 *
 * @param cwd Current working directory
 */
export function ensureRescueDir(cwd: string): void {
  const rescueDir = getRescueDir(cwd)
  if (!existsSync(rescueDir)) {
    mkdirSync(rescueDir, { recursive: true })
  }
}

/**
 * Get path to a checkpoint directory
 *
 * @param cwd Current working directory
 * @param checkpointId Checkpoint identifier
 * @returns Path to checkpoint directory
 */
export function getCheckpointDir(cwd: string, checkpointId: string): string {
  return join(getRescueDir(cwd), checkpointId)
}

/**
 * Validate checkpoint ID format
 * Must be either:
 * - Auto-generated: rescue-YYYY-MM-DD-HHMM
 * - Custom name: alphanumeric, hyphens, underscores (no path separators)
 *
 * @param id Checkpoint ID to validate
 * @returns True if valid
 */
export function isValidCheckpointId(id: string): boolean {
  // Allow auto-generated format or custom alphanumeric names
  // Reject anything with path separators or relative paths
  if (id.includes('/') || id.includes('\\') || id.includes('..')) {
    return false
  }
  return /^rescue-\d{4}-\d{2}-\d{2}-\d{4}$/.test(id) || /^[\w-]+$/.test(id)
}

/**
 * Generate a checkpoint ID based on current timestamp
 *
 * @param customName Optional custom name to use instead of timestamp
 * @returns Generated checkpoint ID
 */
export function generateCheckpointId(customName?: string): string {
  if (customName) {
    // Sanitize custom name
    const sanitized = customName.replace(/[^\w-]/g, '-')
    return sanitized
  }

  // Generate timestamp-based ID: rescue-YYYY-MM-DD-HHMM
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  return `rescue-${year}-${month}-${day}-${hours}${minutes}`
}

/**
 * Save checkpoint metadata to JSON file
 *
 * @param cwd Current working directory
 * @param metadata Checkpoint metadata
 */
export function saveCheckpointMetadata(cwd: string, metadata: CheckpointMetadata): void {
  const checkpointDir = getCheckpointDir(cwd, metadata.id)

  // Create checkpoint directory
  if (!existsSync(checkpointDir)) {
    mkdirSync(checkpointDir, { recursive: true })
  }

  const metadataPath = join(checkpointDir, 'checkpoint.json')
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
}

/**
 * Load checkpoint metadata from JSON file
 *
 * @param cwd Current working directory
 * @param checkpointId Checkpoint identifier
 * @returns Checkpoint metadata or null if not found
 */
export function loadCheckpointMetadata(
  cwd: string,
  checkpointId: string
): CheckpointMetadata | null {
  const metadataPath = join(getCheckpointDir(cwd, checkpointId), 'checkpoint.json')

  if (!existsSync(metadataPath)) {
    return null
  }

  try {
    const content = readFileSync(metadataPath, 'utf-8')
    return JSON.parse(content) as CheckpointMetadata
  } catch {
    return null
  }
}

/**
 * List all checkpoints
 *
 * @param cwd Current working directory
 * @returns Array of checkpoint metadata
 */
export function listCheckpoints(cwd: string): CheckpointMetadata[] {
  const rescueDir = getRescueDir(cwd)

  if (!existsSync(rescueDir)) {
    return []
  }

  const checkpoints: CheckpointMetadata[] = []
  const entries = readdirSync(rescueDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metadata = loadCheckpointMetadata(cwd, entry.name)
      if (metadata) {
        checkpoints.push(metadata)
      }
    }
  }

  // Sort by timestamp (newest first)
  return checkpoints.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Delete a checkpoint
 *
 * @param cwd Current working directory
 * @param checkpointId Checkpoint identifier
 * @returns True if deleted successfully
 */
export function deleteCheckpoint(cwd: string, checkpointId: string): boolean {
  const checkpointDir = getCheckpointDir(cwd, checkpointId)

  if (!existsSync(checkpointDir)) {
    return false
  }

  try {
    rmSync(checkpointDir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

/**
 * Calculate age of checkpoint in human-readable format
 *
 * @param timestamp Unix timestamp in milliseconds
 * @returns Human-readable age string
 */
export function formatCheckpointAge(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

/**
 * Format timestamp as readable date string
 *
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted date string (YYYY-MM-DD HH:MM)
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * Check if checkpoint is older than specified days
 *
 * @param timestamp Checkpoint timestamp
 * @param days Number of days
 * @returns True if checkpoint is older than specified days
 */
export function isOlderThan(timestamp: number, days: number): boolean {
  const now = Date.now()
  const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24)
  return ageInDays > days
}
