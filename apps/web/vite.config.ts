import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const apiPrefix = process.env.VITE_API_PREFIX || '/api';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        [apiPrefix]: {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
          // rewrite: (path) => path.replace(new RegExp(`^${apiPrefix}`), '')
        },
        '/socket.io': {
          target: 'ws://localhost:8080',
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      host: true,
      port: 4173
    }
  };
});
