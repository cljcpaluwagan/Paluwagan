import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production-only Content-Security-Policy: blocks loading code or data from anywhere unexpected.
// 'unsafe-inline' for scripts is kept because some Android WebViews inject the Capacitor bridge inline.
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; object-src 'none'; base-uri 'self'; form-action 'self'";
export default defineConfig({
  plugins: [react(), { name: 'csp', apply: 'build', transformIndexHtml: { order: 'post', handler: (html: string) => html.replace('</head>', `<meta http-equiv="Content-Security-Policy" content="${csp}"></head>`) } }],
});
