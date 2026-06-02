import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const todoistToken = env.VITE_TODOIST_API_TOKEN?.trim()

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifest: false,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}'],
        },
      }),
    ],
    server: todoistToken
      ? {
          proxy: {
            '/api/todoist': {
              target: 'https://api.todoist.com',
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/api\/todoist/, '/api/v1'),
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq) => {
                  proxyReq.setHeader('Authorization', `Bearer ${todoistToken}`)
                  proxyReq.setHeader('Accept', 'application/json')
                })
              },
            },
          },
        }
      : undefined,
  }
})
