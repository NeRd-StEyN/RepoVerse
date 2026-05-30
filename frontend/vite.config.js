import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/generate_report': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/progress': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/report': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/chat': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/report_state': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/update_report': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/rewrite_text': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext'
  }
})