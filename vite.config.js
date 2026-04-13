import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/profiles': 'http://localhost:4000/profiles',
      '/auth': 'http://localhost:4000/auth',
      // if you add more API routes, add them here
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
  },
})
