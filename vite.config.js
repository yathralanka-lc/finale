import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src_web',
  base: './',
  build: {
    outDir: '../www',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild'
  }
});
