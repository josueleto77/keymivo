import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Identifies the deployed version in error reports.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16)) },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
