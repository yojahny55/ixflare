/**
 * @module client
 * @description Client-side utilities for island hydration
 * @client-only
 * @packageDocumentation
 *
 * This module contains client-side code that runs in the browser.
 * It should NOT be imported in server-side code.
 */

export { hydrateIslands, hydrateIslandById, setIslandRegistry, getIslandRegistry } from './hydrate'
