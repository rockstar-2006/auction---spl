import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      'unstuck-deed-sulk.ngrok-free.dev',
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.io'
    ]
  }
})
