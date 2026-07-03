import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Proxy de dev vers l'ENT local (traefik :8090)
const proxyTarget = { target: 'http://localhost:8090', changeOrigin: false };

export default defineConfig(({ mode }) => ({
  // Servi sous /presences par entcore (cf. view vsco_react.html -> /presences/public/index.js)
  base: mode === 'production' ? '/presences' : '',
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      'react-i18next',
      'i18next',
      'react-router-dom',
      '@open-ent/client',
      '@open-ent/react',
      '@open-ent/bootstrap',
    ],
  },
  build: {
    assetsDir: 'public',
    rollupOptions: {
      output: {
        // Noms stables → la vue backend référence des chemins fixes.
        // Le bundle Angular existant est `public/dist/vsco_personnels.js` : pas de collision.
        entryFileNames: 'public/index.js',
        chunkFileNames: 'public/[name].js',
        assetFileNames: (info) =>
          info.name && info.name.endsWith('.css')
            ? 'public/index.css'
            : 'public/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 4204,
    proxy: {
      '/presences': proxyTarget,
      '^/(?=assets|theme|locale|i18n|skin)': proxyTarget,
      '^/(?=auth|userbook|directory|portal|session|timeline|workspace|infra|conf|applications-list)':
        proxyTarget,
    },
  },
  plugins: [react()],
}));
