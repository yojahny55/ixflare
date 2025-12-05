#!/usr/bin/env node
/**
 * @module create-ixflare
 * @description CLI entry point for creating new Ixflare projects
 */

import { main } from './cli'

main().catch(console.error)
