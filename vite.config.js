import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Rolldown ko bypass karne ke liye experimental/bundler flag
  experimental: {
    // Kuch versions mein rolldown flags ko override karne ke liye build options ka use hota hai
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      // Rollup engine force karne ke liye
    }
  },
})