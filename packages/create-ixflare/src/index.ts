#!/usr/bin/env node
/**
 * @module create-ixflare
 * @description CLI entry point for creating new Ixflare projects
 */

import { main } from './cli'

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
