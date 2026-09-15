import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/content.ts'),
      formats: ['iife'],
      name: 'PoopTranslatorContent',
      fileName: () => 'assets/content.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
