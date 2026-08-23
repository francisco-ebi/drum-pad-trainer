/// <reference types="vitest/config" />
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Public base path for the built site.
 *
 * `BASE_PATH` comes from `actions/configure-pages`, which also knows to use
 * `/` when the site is served from a custom domain. Local dev and `vite
 * preview` fall back to `/` unless it is set.
 */
function resolveBase(): string {
  const configured = process.env.BASE_PATH;
  if (configured !== undefined) {
    const trimmed = configured.trim();
    if (trimmed === "" || trimmed === "/") return "/";
    const leading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return leading.endsWith("/") ? leading : `${leading}/`;
  }
  const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
  return repository ? `/${repository}/` : "/";
}

/**
 * GitHub Pages serves no rewrites, so a deep link like `/library` would 404
 * before the router ever loaded. Pages serves `404.html` for unknown paths, so
 * shipping a copy of the shell there boots the app with the URL intact.
 */
function pagesFallbackPlugin(): Plugin {
  return {
    name: 'pages-404-fallback',
    apply: 'build',
    closeBundle() {
      const index = resolve('dist', 'index.html')
      if (existsSync(index)) copyFileSync(index, resolve('dist', '404.html'))
    },
  }
}

export default defineConfig({
  base: resolveBase(),
  plugins: [react(), pagesFallbackPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/shared/lib/testing/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
