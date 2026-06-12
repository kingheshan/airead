// Transparent streaming proxy for the OpenAI API, running on EdgeOne Pages
// (overseas edge nodes can reach api.openai.com; the mainland VM cannot).
// The VM sets OPENAI_BASE_URL to https://<edgeone-domain>/v1 — the API key
// stays on the VM and travels through in the Authorization header; nothing
// is logged or stored here.
const UPSTREAM = 'https://api.openai.com';

const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'openai-organization',
  'openai-project',
  'openai-beta'
];

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
      }
    });
  }

  if (!request.headers.get('authorization')) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
  }

  const upstreamResp = await fetch(UPSTREAM + url.pathname + url.search, {
    method: request.method,
    headers,
    body,
    redirect: 'follow'
  });

  // Pass the upstream body through as a stream (SSE included) so long
  // generations keep bytes flowing and never hit idle-timeout walls.
  const respHeaders = new Headers();
  for (const [k, v] of upstreamResp.headers.entries()) {
    if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k.toLowerCase())) continue;
    respHeaders.set(k, v);
  }
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('X-Accel-Buffering', 'no');

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: respHeaders
  });
}
