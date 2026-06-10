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
        process.env[key] = val;
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
