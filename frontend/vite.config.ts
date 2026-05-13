import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import tailwindcss from "@tailwindcss/vite"
import { execSync } from 'node:child_process'

// Read version from package.json + unique build timestamp for version detection
import { readFileSync } from 'fs';
const PKG_VERSION = JSON.parse(readFileSync('./package.json', 'utf-8')).version;
const BUILD_HASH = `${PKG_VERSION}+${Date.now()}`;

// Git SHA for runtime version comparison — GitHub Actions sets GITHUB_SHA in CI
const gitSha = (() => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim(); }
  catch { return 'dev'; }
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
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['@tanstack/react-router'],
            query: ['@tanstack/react-query'],
            'radix-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
            auth: ['@kinde-oss/kinde-auth-react'],
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
        '@kinde-oss/kinde-auth-react',
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