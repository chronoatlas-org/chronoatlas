import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the built site works at any address, including the GitHub Pages
  // project URL (https://chronoatlas-org.github.io/chronoatlas/).
  base: './',
  // MapLibre starts its worker as a JavaScript module, so bundle workers in module format.
  worker: { format: 'es' },
  build: {
    // MapLibre alone is about 1 MB (roughly 280 KB compressed), which is expected for a map
    // library. Raise the warning threshold so real size problems still stand out.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // Keep libraries' license notices (e.g. MapLibre's BSD license) in the published code.
        // Their licenses require the notice to travel with every copy.
        comments: { legal: true },
      },
    },
  },
});
