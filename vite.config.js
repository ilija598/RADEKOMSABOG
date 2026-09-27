import { defineConfig } from 'vite';
import sr from './src/content/sr.js';
import { createI18n } from './src/i18n.js';
import { createLayout } from './src/layout.js';

// Prerender the default language from the same dictionaries, including social metadata.
// Runtime i18n updates these nodes in place without replacing the form.
export default defineConfig({
  build: { rollupOptions: { input: { home: 'index.html', challengeri: 'challengeri.html' } } },
  plugins: [{
    name: 'rade-default-language',
    transformIndexHtml(html) {
      const escape = text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return html.replace('<title>RADE KOMŠA</title>', `<title>${sr.meta.title}</title>`)
        .replace('name="description" content=""', `name="description" content="${escape(sr.meta.description)}"`)
        .replace('property="og:title" content=""', `property="og:title" content="${escape(sr.meta.title)}"`)
        .replace('property="og:description" content=""', `property="og:description" content="${escape(sr.meta.description)}"`)
        .replace('<div id="app"></div>', `<div id="app">${createLayout(createI18n())}</div>`);
    },
  }],
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
});
