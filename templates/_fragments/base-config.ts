/**
 * Shared configuration fragments for templates
 */

export const baseEdgeConfig = {
  name: '{{projectName}}',
  database: {
    binding: 'DB',
    warmup: true,
  },
  cache: {
    binding: 'CACHE',
    defaultTtl: 3600,
  },
  security: {
    csrf: true,
    headers: true,
  },
}
