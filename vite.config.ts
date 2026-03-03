import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2015', // 支持更广泛的浏览器
    cssTarget: 'chrome61', // CSS 兼容性
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  esbuild: {
    target: 'es2015', // 确保 esbuild 也使用兼容目标
  },
})
