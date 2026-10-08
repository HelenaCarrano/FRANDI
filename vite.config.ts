import { defineConfig } from 'vite';

// base relativa: o build funciona em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages)
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
