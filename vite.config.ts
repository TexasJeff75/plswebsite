import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        contact: 'contact.html',
        compliance: 'compliance.html',
        services: 'services.html',
        'why-proximity': 'why-proximity.html',
        'deployment-tracker': 'deployment-tracker.html',
        'tracker': 'tracker.html'
      }
    }
  }
});