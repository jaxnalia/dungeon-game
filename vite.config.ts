import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
})
