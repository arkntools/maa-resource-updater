import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { comlink } from 'vite-plugin-comlink';
import { startProxy } from './node/proxy';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  if (command === 'serve') startProxy();
  return {
    plugins: [comlink(), vue()],
    worker: {
      plugins: () => [comlink()],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
