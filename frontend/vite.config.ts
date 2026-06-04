import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import tailwindcss from "@tailwindcss/vite"
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { execSync } from 'node:child_process'

// Read version from package.json + unique build timestamp for version detection
import { readFileSync } from 'fs';
const PKG_VERSION = JSON.parse(readFileSync('./package.json', 'utf-8')).version;
const BUILD_HASH = `${PKG_VERSION}+${Date.now()}`;

// Git SHA for runtime version comparison — full 40-char SHA so it matches /api/version response.
// Priority: VITE_GIT_SHA (set in CI env block) → GITHUB_SHA → local git → dev fallback.
const gitSha = (() => {
  if (process.env.VITE_GIT_SHA) return process.env.VITE_GIT_SHA;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try { return execSync('git rev-parse HEAD', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); }
  catch { return `dev-${Date.now().toString(36)}`; }
})();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: any[] = [
    // Inject build hash meta tag into index.html at build time
    {
      name: 'inject-build-hash',
      transformIndexHtml(html: string) {
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta name="app-version" content="${BUILD_HASH}" />`
        );
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Wrapper Frontend',
        short_name: 'Wrapper',
        description: 'A modern React application for business management',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // cleanupOutdatedCaches: Workbox deletes stale precache versions on activate.
        cleanupOutdatedCaches: true,
        // clientsClaim: after the new SW activates (user triggers SKIP_WAITING via
        // the banner), it immediately controls all open tabs — no "only affects new
        // tabs" lag. Combined with registerType:'prompt' (skipWaiting:false), the
        // user explicitly triggers the swap rather than being silently updated mid-session.
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })
  ]

  // Add bundle analyzer in analyze mode
  if (mode === 'analyze') {
    plugins.push(visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }))
  }

  // Sentry sourcemap upload — LAST plugin. No-op locally (only runs in CI where
  // SENTRY_AUTH_TOKEN is set). Uploads + deletes the hidden sourcemaps so stack
  // traces are readable in Sentry without exposing maps to users.
  if (process.env.SENTRY_AUTH_TOKEN) {
    plugins.push(sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: gitSha },
    }))
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@features': path.resolve(__dirname, './src/features'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@stores': path.resolve(__dirname, './src/stores'),
        '@types': path.resolve(__dirname, './src/types'),
      },
    },
    server: {
      port: 3001,
      open: true,
      host: true, // Allow external connections
      cors: true,
      // Proxy API requests to the backend dev server — eliminates cross-origin issues in dev
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          secure: false,
        },
      },
      // Enable HMR for better DX
      hmr: {
        overlay: true,
      },
      // Ignore non-source paths so edits to docs/config don't trigger HMR or page reloads
      watch: {
        ignored: [
          '**/.env',
          '**/.env.*',
          '**/node_modules/**',
          '**/vite.config.ts',
          '**/docs/**',
          '**/.husky/**',
          '**/coverage/**',
          '**/dist/**',
          '**/*.md',
          '**/scripts/**',
          '**/.cursor/**',
          '**/package.json',
          '**/tsconfig.json',
          '**/tsconfig.*.json',
          '**/index.html',
          '**/main.tsx',
        ],
      },
    },
    build: {
      outDir: 'dist',
      // 'hidden' in prod: generate sourcemaps for Sentry upload but don't
      // reference them in the bundles (not exposed to users).
      sourcemap: mode === 'production' ? 'hidden' : true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['@tanstack/react-router'],
            query: ['@tanstack/react-query'],
            'radix-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
            forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
            motion: ['framer-motion'],
            reactflow: ['reactflow'],
          },
        },
      },
      minify: 'esbuild',
    },
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger'],
    } : {},
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        '@tanstack/react-router',
        'zod',
        'react-hook-form',
        'canvas-confetti',
        'sonner',
      ],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      __APP_VERSION__: JSON.stringify(gitSha),
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BUILD_HASH__: JSON.stringify(BUILD_HASH),
    },
  }
}) 