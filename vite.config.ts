import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        viteStaticCopy({
          targets: [
            { src: 'node_modules/@fontsource/inter/files/*', dest: 'assets/files' },
            { src: 'node_modules/@fontsource/jetbrains-mono/files/*', dest: 'assets/files' },
          ],
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.DOUBAO_API_KEY || env.VOLCENGINE_API_KEY),
        'process.env.DOUBAO_API_KEY': JSON.stringify(env.DOUBAO_API_KEY || env.VOLCENGINE_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
