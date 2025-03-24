export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  console.log(`Debug - Received request for: ${url.pathname}, method: ${request.method}`);
  console.log('Available bindings:', Object.keys(env));

  try {
    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      // Verify KV binding
      if (!env.CLAIMS) {
        console.error('CLAIMS binding not found in env');
        return new Response(JSON.stringify({ 
          error: 'KV binding not configured',
          availableBindings: Object.keys(env)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /api/claim - Handle item claiming
      if (url.pathname === '/api/claim' && request.method === 'POST') {
        try {
          const body = await request.json();
          console.log('Claim request body:', body);
          
          const { item, claimer } = body;
          if (!item || !claimer) {
            console.log('Missing item or claimer:', { item, claimer });
            return new Response(JSON.stringify({ error: 'Missing item or claimer' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          console.log('Attempting to store claim:', { item, claimer });
          await env.CLAIMS.put(item, claimer);
          console.log('Successfully stored claim');
          
          return new Response(JSON.stringify({ success: true, item, claimer }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          });
        } catch (error) {
          console.error('Error claiming item:', error.message, error.stack);
          return new Response(JSON.stringify({ 
            error: 'Failed to claim item',
            details: error.message 
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
          });
        }
      }

      // GET /api/claims - Get all claims
      if (url.pathname === '/api/claims' && request.method === 'GET') {
        try {
          console.log('Fetching all claims');
          const claims = await env.CLAIMS.list();
          const result = {};
          for (const key of claims.keys) {
            result[key.name] = await env.CLAIMS.get(key.name);
          }
          console.log('Retrieved claims:', result);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          });
        } catch (error) {
          console.error('Error fetching claims:', error.message, error.stack);
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch claims',
            details: error.message 
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
          });
        }
      }

      // If API route not found
      console.log('API endpoint not found:', url.pathname);
      return new Response(JSON.stringify({ error: 'API endpoint not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // For all other requests, try to serve static files
    try {
      const response = await context.env.ASSETS.fetch(request);
      if (!response) {
        throw new Error('No response from static assets');
      }
      return response;
    } catch (error) {
      console.error('Error serving static file:', error);
      return Response.redirect(new URL('/', request.url), 302);
    }
  } catch (error) {
    console.error('Worker error:', error.message, error.stack);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      availableBindings: Object.keys(env)
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 