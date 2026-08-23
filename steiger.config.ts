import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Seed patterns are data, not code: one JSON file per pattern is the point.
    files: ['./src/entities/pattern/seeds/**'],
    rules: {
      'fsd/segments-by-purpose': 'off',
    },
  },
  {
    // M1 scaffolding: several slices are intentionally single-reference until
    // M2/M3 wire up the remaining pages and features.
    rules: {
      'fsd/insignificant-slice': 'off',
      'fsd/public-api': 'error',
      'fsd/forbidden-imports': 'error',
      'fsd/no-layer-public-api': 'off',
    },
  },
])
