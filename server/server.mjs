// Self-hosted adapter: serves index.html and bridges HTTP requests to the
// Netlify-style function handlers in netlify/functions/, for deployments on a
// plain VM behind nginx (e.g. http://host/airead/).
//
// Usage: node server/server.mjs   (PORT defaults to 3100, binds 127.0.0.1)
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env (KEY=VALUE lines) without external deps; real env vars win.
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim();
    }
  }
}

const FUNCTIONS_DIR = path.join(ROOT, 'netlify', 'functions');
const INDEX_HTML = path.join(ROOT, 'index.html');

const app = express();
app.disable('x-powered-by');
// Keep the raw body as a string: function handlers expect event.body and run
// their own JSON.parse with error handling.
app.use(express.text({ type: '*/*', limit: '25mb' }));

async function invokeFunction(req, res) {
  const name = String(req.params.name || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const modulePath = path.join(FUNCTIONS_DIR, `${name}.mjs`);
  if (!name || !fs.existsSync(modulePath)) {
    res.status(404).json({ error: `Function not found: ${name}` });
    return;
  }
  try {
    const mod = await import(modulePath);
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
      queryStringParameters: req.query,
      path: req.path
    };
    const result = await mod.handler(event);
    res.status(result.statusCode || 200);
    for (const [k, v] of Object.entries(result.headers || {})) {
      res.setHeader(k, v);
    }
    res.send(result.body || '');
  } catch (error) {
    console.error(`[airead] function ${name} failed:`, error);
    res.status(500).json({ error: error.message || 'Internal function error' });
  }
}

// API routes — with and without the /airead prefix (nginx passes the path through).
app.all('/.netlify/functions/:name', invokeFunction);
app.all('/airead/.netlify/functions/:name', invokeFunction);

// Static page — root and sub-path entries.
const sendIndex = (req, res) => res.sendFile(INDEX_HTML);
app.get(['/', '/index.html', '/v2', '/v2/', '/airead', '/airead/', '/airead/index.html', '/airead/v2', '/airead/v2/'], sendIndex);

app.get(['/healthz', '/airead/healthz'], (req, res) => res.json({ ok: true, service: 'airead' }));

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`[airead] server listening on http://${HOST}:${PORT}`);
});
