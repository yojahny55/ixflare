/**
 * @fileoverview ESLint plugin for Ixflare environment boundary enforcement
 * @node-only
 */

import { environmentBoundaries } from './rules/environment-boundaries'

const plugin = {
  meta: {
    name: 'eslint-plugin-ixflare',
    version: '0.1.0',
  },
  rules: {
    'environment-boundaries': environmentBoundaries,
  },
  configs: {
    recommended: {
      plugins: ['ixflare'],
      rules: {
        'ixflare/environment-boundaries': 'error',
      },
    },
  },
}

export default plugin
