import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
        contact: 'contact.html',
        compliance: 'compliance.html',
        services: 'services.html',
        'why-proximity': 'why-proximity.html'
      }
    }
  }
});