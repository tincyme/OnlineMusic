import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
  define: { __PREVIEW__: JSON.stringify(mode === 'preview') },
  build: { outDir: 'dist', sourcemap: false },
}));
