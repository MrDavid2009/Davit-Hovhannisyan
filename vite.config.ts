import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2020', // Ensure broad mobile browsers (older Safari/iOS) compatibility
      minify: 'esbuild',
      cssMinify: true,
      chunkSizeWarningLimit: 3000, // Increase chunk size limit to bypass warnings
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'firebase-provider';
              }
              if (id.includes('jszip')) {
                return 'jszip-compress';
              }
              if (id.includes('motion') || id.includes('framer-motion')) {
                return 'motion-animator';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                return 'react-framework';
              }
              return 'vendor-core';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
