import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Build for a path prefix with `PATHFOLIO_BASE=/pathfolio/ npm run build`.
  // Dev and the default build stay at '/'.
  base: process.env.PATHFOLIO_BASE || '/',
  server: {
    port: 5180,
    strictPort: true, // never drift into a port another project is using
    // Listen on every interface so a classmate on the same network can open the
    // app. The API stays bound to 127.0.0.1 — the proxy below forwards /v1 and
    // /healthz server-side, so port 8000 is never exposed.
    host: true,
    // Vite 5.4.12+ rejects a request whose Host header is not localhost. The
    // cloudflared quick tunnel arrives as *.trycloudflare.com, so allow that
    // family rather than switching the check off entirely.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/v1': 'http://127.0.0.1:8000',
      '/healthz': 'http://127.0.0.1:8000',
    },
  },
})
