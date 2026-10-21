import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [
    react(),
    VitePWA({
      selfDestroying: true,
      includeAssets: [
        'cheras-logo.png',
        'cheras-logo-white.png',
        'cheras-icon.png',
        'cheras-icon-white.png',
        'cheras-icon-192.png',
        'cheras-icon-512.png',
        'cheras-icon-maskable-192.png',
        'cheras-icon-maskable-512.png',
        'cheras-favicon.png',
        'apple-touch-icon.png',
        'favicon.png',
        'robots.txt',
      ],
      manifest: {
        name: 'CHERAS CLOTHING POS',
        short_name: 'CHERAS CLOTHING',
        description: 'CHERAS CLOTHING retail billing, barcode inventory, order, receipt, and invoice administration.',
        theme_color: '#171717',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/cheras-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/cheras-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/cheras-icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/cheras-icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,jpg,woff,woff2}'],
        navigateFallbackDenylist: [/^\/api/, /^\/admin/, /supabase/, /^\/assets\//, /\.[a-zA-Z0-9]+$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('react-smooth') || id.includes('victory-')) return 'charts'
          if (id.includes('react-router')) return 'router'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('jsbarcode') || id.includes('@zxing')) return 'barcode'
          if (id.includes('workbox') || id.includes('vite-plugin-pwa')) return 'pwa'
          return 'vendor'
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    allowedHosts: true,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https: blob: data: http://localhost:* ws://localhost:*; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; connect-src 'self' https: wss: ws: blob: data: http://localhost:* ws://localhost:*; media-src 'self' data: blob: https:; worker-src 'self' blob: data:; child-src 'self' blob:; object-src 'none'; base-uri 'self';",
    },
  },
})
