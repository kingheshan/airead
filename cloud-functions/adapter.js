function decodeKey(val) {
  if (!val) return val;
  const trimmedVal = val.trim();
  let decodedVal = trimmedVal;
  if (trimmedVal.includes('__DOUBLE_DASH__')) {
    decodedVal = trimmedVal.replace(/__DOUBLE_DASH__/g, '--');
  } else if (!trimmedVal.startsWith('sk-')) {
    let decoded = null;
    // 1. Try Hex decoding (Hex consists only of 0-9, a-f, A-F)
    if (/^[0-9a-fA-F]+$/.test(trimmedVal)) {
      try {
        const hexDecoded = Buffer.from(trimmedVal, 'hex').toString('utf8');
        if (hexDecoded.startsWith('sk-')) {
          decoded = hexDecoded;
        }
      } catch (e) {}
    }
    // 2. Try Base64 decoding (Base64 can have padding '=' or not)
    if (!decoded) {
      try {
        const base64Decoded = Buffer.from(trimmedVal, 'base64').toString('utf8');
        if (base64Decoded.startsWith('sk-')) {
          decoded = base64Decoded;
        }
      } catch (e) {}
    }
    if (decoded) {
      decodedVal = decoded;
    }
  }
  return decodedVal.trim();
}

// Decode OPENAI_API_KEY on startup if present in process.env
if (process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = decodeKey(process.env.OPENAI_API_KEY);
}

export function makeAdapter(handler) {
  return async function onRequest(context) {
    const { request, env } = context;
    
    // Return 204 synchronously for OPTIONS requests
    if (request.method === 'OPTIONS') {
      const responseHeaders = new Headers();
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
      responseHeaders.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      return new Response(null, {
        status: 204,
        headers: responseHeaders
      });
    }

    // Parse request headers
    const headers = {};
    for (const [key, val] of request.headers.entries()) {
      headers[key] = val;
    }
    
    // Parse request URL and query parameters
    const url = new URL(request.url);
    const queryStringParameters = {};
    for (const [key, val] of url.searchParams.entries()) {
      queryStringParameters[key] = val;
    }
    
    // Parse request body if applicable
    let body = '';
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.text();
    }
    
    const event = {
      path: url.pathname,
      httpMethod: request.method,
      headers,
      queryStringParameters,
      body
    };
    
    // Set Netlify environment variables from EdgeOne environment variables
    if (env) {
      for (const [key, val] of Object.entries(env)) {
        if (key === 'OPENAI_API_KEY' && val) {
          process.env[key] = decodeKey(val);
        } else {
          process.env[key] = val;
        }
      }
    }
    
    // Always ensure process.env.OPENAI_API_KEY is decoded
    if (process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = decodeKey(process.env.OPENAI_API_KEY);
    }
    
    // Standard response headers for all API requests
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
    responseHeaders.set('X-Accel-Buffering', 'no');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
    responseHeaders.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

    // Return a stream immediately to keep connection alive and reset gateway timeouts
    const stream = new ReadableStream({
      async start(controller) {
        // Enqueue a newline to flush headers immediately
        controller.enqueue(new TextEncoder().encode('\n'));
        
        // Start a heartbeat timer to write a space every 1 second to prevent idle gateway timeouts
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(' '));
          } catch (e) {
            // Stream might be closed or errored, clear interval
            clearInterval(heartbeatInterval);
          }
        }, 1000);
        
        try {
          const response = await handler(event, {});
          
          // Clear heartbeat interval before enqueuing the main response
          clearInterval(heartbeatInterval);
          
          if (response && response.body) {
            controller.enqueue(new TextEncoder().encode(response.body));
          } else {
            controller.enqueue(new TextEncoder().encode('{}'));
          }
        } catch (error) {
          clearInterval(heartbeatInterval);
          console.error(`[EdgeOne Cloud Function] Error running handler:`, error);
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            error: error.message || 'Internal server error from adapter.',
            stack: error.stack
          })));
        } finally {
          clearInterval(heartbeatInterval);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: responseHeaders
    });
  };
}
