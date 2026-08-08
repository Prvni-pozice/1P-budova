import { defineConfig } from 'vite'

export default defineConfig({
  server: { host: true, port: 5186 },
  preview: { host: true, port: 5186 },
  build: { target: 'es2019' },
})
