/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Public base path for the built site.
 *
 * GitHub Pages serves a project site from `/<repo>/`, and this repo is named
 * `drum-path-trainer` while the package is `drum-pad-trainer` — so the base is
 * taken from the deploy environment rather than written down here, where the
 * two could drift apart unnoticed.
 *
 * `BASE_PATH` comes from `actions/configure-pages`, which also knows to use
 * `/` when the site is served from a custom domain. Local dev and `vite
 * preview` fall back to `/` unless it is set.
 */
function resolveBase(): string {
  const configured = process.env.BASE_PATH
  if (configured !== undefined) {
    const trimmed = configured.trim()
    if (trimmed === '' || trimmed === '/') return '/'
    const leading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    return leading.endsWith('/') ? leading : `${leading}/`
  }
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
  return repository ? `/${repository}/` : '/'
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/shared/lib/testing/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
