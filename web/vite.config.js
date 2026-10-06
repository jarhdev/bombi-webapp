import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // N8N_BASE_URL no lleva prefijo VITE_: nunca llega al navegador.
  // En local, Vite reenvía /api/* a n8n igual que el proxy de Netlify en producción.
  const env = loadEnv(mode, process.cwd(), '')
  const n8n = env.N8N_BASE_URL?.replace(/\/$/, '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Bombi Control',
          short_name: 'Bombi',
          description: 'Ventas, gastos y cuentas por cobrar de Bombi',
          lang: 'es-VE',
          start_url: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f4e9d6',
          theme_color: '#6f1425',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Cachea solo la app. Los datos (/api) siempre van a la red.
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        },
      }),
    ],
    server: {
      host: true,
      proxy: n8n ? { '/api': { target: n8n, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '/webhook/bombi') } } : undefined,
    },
  }
})
