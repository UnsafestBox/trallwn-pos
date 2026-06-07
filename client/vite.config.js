import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE || '/api'
  const serverPort = env.VITE_SERVER_PORT || '3001'

  return {
    plugins: [react()],
    server: {
      proxy: {
        [apiBase]: {
          target: `http://localhost:${serverPort}`,
          rewrite: (path) => path.replace(new RegExp(`^${apiBase}`), '/api'),
        },
      },
    },
  }
})
