import { defineConfig } from 'vite';

export default defineConfig({
  // Honour a PORT from the environment so tooling can place the dev server.
  server: { port: Number(process.env.PORT) || 5173 },
  preview: { port: Number(process.env.PORT) || 4173 },
  build: {
    target: 'esnext',
    modulePreload: { polyfill: false },
    cssMinify: true,
    reportCompressedSize: true,
  },
});
