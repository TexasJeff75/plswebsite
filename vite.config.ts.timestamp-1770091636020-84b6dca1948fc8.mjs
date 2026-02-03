// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
import { copyFileSync } from "fs";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "copy-redirects",
      writeBundle() {
        copyFileSync("_redirects", "dist/_redirects");
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        about: "about.html",
        contact: "contact.html",
        compliance: "compliance.html",
        services: "services.html",
        "why-proximity": "why-proximity.html",
        "deployment-tracker": "deployment-tracker.html",
        "tracker": "tracker.html"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjb3B5RmlsZVN5bmMgfSBmcm9tICdmcyc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB7XG4gICAgICBuYW1lOiAnY29weS1yZWRpcmVjdHMnLFxuICAgICAgd3JpdGVCdW5kbGUoKSB7XG4gICAgICAgIGNvcHlGaWxlU3luYygnX3JlZGlyZWN0cycsICdkaXN0L19yZWRpcmVjdHMnKTtcbiAgICAgIH1cbiAgICB9XG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgbWFpbjogJ2luZGV4Lmh0bWwnLFxuICAgICAgICBhYm91dDogJ2Fib3V0Lmh0bWwnLFxuICAgICAgICBjb250YWN0OiAnY29udGFjdC5odG1sJyxcbiAgICAgICAgY29tcGxpYW5jZTogJ2NvbXBsaWFuY2UuaHRtbCcsXG4gICAgICAgIHNlcnZpY2VzOiAnc2VydmljZXMuaHRtbCcsXG4gICAgICAgICd3aHktcHJveGltaXR5JzogJ3doeS1wcm94aW1pdHkuaHRtbCcsXG4gICAgICAgICdkZXBsb3ltZW50LXRyYWNrZXInOiAnZGVwbG95bWVudC10cmFja2VyLmh0bWwnLFxuICAgICAgICAndHJhY2tlcic6ICd0cmFja2VyLmh0bWwnXG4gICAgICB9XG4gICAgfVxuICB9XG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixTQUFTLG9CQUFvQjtBQUc3QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTjtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sY0FBYztBQUNaLHFCQUFhLGNBQWMsaUJBQWlCO0FBQUEsTUFDOUM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sT0FBTztBQUFBLFFBQ1AsU0FBUztBQUFBLFFBQ1QsWUFBWTtBQUFBLFFBQ1osVUFBVTtBQUFBLFFBQ1YsaUJBQWlCO0FBQUEsUUFDakIsc0JBQXNCO0FBQUEsUUFDdEIsV0FBVztBQUFBLE1BQ2I7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
