import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

// Domínio público: o build de produção recebe do deploy/deploy.ps1; sem ele, o domínio definitivo.
const site = process.env.PUBLIC_SITE_BASE_URL || 'https://falcaolimpeza.com.br';

// https://astro.build/config
export default defineConfig({
  site,
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  // Atrás do nginx: sem isso o adapter Node ignora o Host, monta a URL como "localhost"
  // e a checagem de origem do Astro barra os uploads (multipart) do CMS com 403.
  security: { allowedDomains: [{ hostname: new URL(site).hostname }] },
  // CSS embutido no HTML: elimina o request de CSS que bloqueava a renderização (PageSpeed: FCP/LCP).
  build: { inlineStylesheets: 'always' },
  integrations: [react()]
});
