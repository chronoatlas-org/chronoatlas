import { existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { defineConfig } from 'vite';
import type { Connect, Plugin } from 'vite';

/**
 * Answers "404 Not Found" for a map tile under /data/ that doesn't exist, as GitHub Pages does. The
 * build leaves out empty map tiles (Phase 5), and MapLibre draws nothing for a missing tile; but
 * Vite's own servers would otherwise answer with the page itself, which MapLibre can't read.
 */
function missingDataIsNotFound(): Plugin {
  const handler = (folder: string): Connect.NextHandleFunction => (req, res, next) => {
    const path = decodeURIComponent((req.url ?? '').split('?')[0]);
    // Only map tiles (the files the build leaves out when empty), under public/data/. Other
    // addresses under /data/ can be the repository's own data folder, which Vite serves too.
    if (!path.startsWith('/data/') || !path.endsWith('.pbf')) return next();
    const file = normalize(join(folder, path.slice(1)));
    if (!file.startsWith(normalize(folder)) || existsSync(file)) return next();
    res.statusCode = 404;
    res.end();
  };
  return {
    name: 'missing-data-is-not-found',
    configureServer: (server) => void server.middlewares.use(handler(join(server.config.root, 'public'))),
    configurePreviewServer: (server) => void server.middlewares.use(handler(join(server.config.root, server.config.build.outDir))),
  };
}

export default defineConfig({
  // Relative paths, so the built site works at any address, including the GitHub Pages
  // project URL (https://chronoatlas-org.github.io/chronoatlas/).
  base: './',
  plugins: [missingDataIsNotFound()],
  server: {
    // Don't watch the built data: the worldwide map has over 100,000 tile files, more than a
    // computer may allow to be watched, and the dev server serves them from disk anyway. After
    // `npm run build-data`, reload the page.
    watch: { ignored: ['**/public/data/**'] },
  },
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
