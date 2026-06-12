// Transparent streaming proxy for the OpenAI API, for Deno Deploy.
// Mainland VMs cannot reach api.openai.com directly but can reach *.deno.dev;
// the self-hosted backend points OPENAI_BASE_URL at https://<proj>.deno.dev/v1.
//
// Security: the OpenAI API key is never stored here — it travels through in the
// caller's Authorization header and is forwarded verbatim. An optional
// PROXY_SHARED_SECRET (set as a Deno Deploy env var) gates access via the
// X-Proxy-Secret header so the endpoint isn't an open relay.
const UPSTREAM = "https://api.openai.com";
const SHARED_SECRET = Deno.env.get("PROXY_SHARED_SECRET") || "";

const HOP_BY_HOP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Proxy-Secret",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      },
    });
  }

  // Health check (no upstream call, no auth)
  if (url.pathname === "/" || url.pathname === "/healthz") {
    return Response.json({ ok: true, service: "openai-proxy" });
  }

  if (SHARED_SECRET && req.headers.get("x-proxy-secret") !== SHARED_SECRET) {
    return Response.json({ error: "Forbidden: invalid proxy secret." }, { status: 403 });
  }

  if (!req.headers.get("authorization")) {
    return Response.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  const headers = new Headers(req.headers);
  headers.set("host", "api.openai.com");
  headers.delete("x-proxy-secret");

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : req.body;

  const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
    method: req.method,
    headers,
    body,
    redirect: "follow",
  });

  const respHeaders = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    respHeaders.set(k, v);
  }
  respHeaders.set("Access-Control-Allow-Origin", "*");
  respHeaders.set("X-Accel-Buffering", "no");

  // Stream the upstream body straight through (SSE-friendly for long generations)
  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
});
