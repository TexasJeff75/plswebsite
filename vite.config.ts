import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-redirects',
      writeBundle() {
        copyFileSync('_redirects', 'dist/_redirects');
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        contact: 'contact.html',
        compliance: 'compliance.html',
        services: 'services.html',
        'why-proximity': 'why-proximity.html',
        'tracker': 'tracker.html'
      }
    }
  }
});