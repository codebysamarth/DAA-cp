import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development, /api requests are forwarded to the backend (port 5000).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:5000' },
  },
});
