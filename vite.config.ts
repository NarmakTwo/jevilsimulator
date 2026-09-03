import { defineConfig } from 'vite';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  root: 'src',
  publicDir: '../src/assets',
  plugins: [
    compression({
      algorithms: ['brotliCompress'],
      include: /\.(js|css|html|svg|json)$/,
      threshold: 0
    })
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3
      },
      toplevel: true
    },
    outDir: "../public",
    emptyOutDir: true, 
    cssCodeSplit: false, // Compiles all CSS into a single file as well
    rollupOptions: {
      output: {manualChunks: undefined},
    },
  },
});