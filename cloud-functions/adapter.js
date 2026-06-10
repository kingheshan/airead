export function makeAdapter(handler) {
  return async function onRequest(context) {
    const { request, env } = context;
    
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
        let decodedVal = val;
        if (key === 'OPENAI_API_KEY' && val) {
          if (val.includes('__DOUBLE_DASH__')) {
            decodedVal = val.replace(/__DOUBLE_DASH__/g, '--');
          } else if (!val.startsWith('sk-')) {
            let decoded = null;
            // 1. Try Hex decoding (Hex consists only of 0-9, a-f, A-F)
            if (/^[0-9a-fA-F]+$/.test(val)) {
              try {
                const hexDecoded = Buffer.from(val, 'hex').toString('utf8');
                if (hexDecoded.startsWith('sk-')) {
                  decoded = hexDecoded;
                }
              } catch (e) {}
            }
            // 2. Try Base64 decoding (Base64 can have padding '=' or not)
            if (!decoded) {
              try {
                const base64Decoded = Buffer.from(val, 'base64').toString('utf8');
                if (base64Decoded.startsWith('sk-')) {
                  decoded = base64Decoded;
                }
              } catch (e) {}
            }
            if (decoded) {
              decodedVal = decoded;
            }
          }
        }
        process.env[key] = decodedVal;
      }
    }
    
    try {
      const response = await handler(event, {});
      
      // Convert Netlify response back to Web API Response
      const responseHeaders = new Headers();
      if (response.headers) {
        for (const [key, val] of Object.entries(response.headers)) {
          responseHeaders.set(key, val);
        }
      }
      
      const isNullBodyStatus = [101, 204, 205, 304].includes(response.statusCode);
      const body = isNullBodyStatus ? null : response.body;
      
      return new Response(body, {
        status: response.statusCode || 200,
        headers: responseHeaders
      });
    } catch (error) {
      console.error(`[EdgeOne Cloud Function] Error running handler:`, error);
      return new Response(JSON.stringify({
        error: error.message || 'Internal server error from adapter.',
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}
