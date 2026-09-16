import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fixed port so it matches the origin you register with core-authorization
// (npm run client -- origins add rms-web-dev http://localhost:5175).
export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true },
});
