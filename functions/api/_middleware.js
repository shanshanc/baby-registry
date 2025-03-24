export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  
  console.log(`[Debug] Received request for: ${url.pathname}, method: ${request.method}`);
  console.log('[Debug] Available bindings:', Object.keys(env));

  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  // Only handle /api routes in this middleware
  if (!url.pathname.startsWith('/api/')) {
    console.log('[Debug] Not an API route, passing through');
    return next();
  }

  try {
    // Verify KV binding
    if (!env.CLAIMS) {
      console.error('[Error] CLAIMS binding not found in env');
      return new Response(JSON.stringify({ 
        error: 'KV binding not configured',
        availableBindings: Object.keys(env)
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/claim - Handle item claiming
    if (url.pathname === '/api/claim' && request.method === 'POST') {
      try {
        const body = await request.json();
        console.log('[Debug] Claim request body:', body);
        
        const { item, claimer } = body;
        if (!item || !claimer) {
          console.log('[Error] Missing item or claimer:', { item, claimer });
          return new Response(JSON.stringify({ error: 'Missing item or claimer' }), { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('[Debug] Attempting to store claim:', { item, claimer });
        await env.CLAIMS.put(item, claimer);
        console.log('[Debug] Successfully stored claim');
        
        return new Response(JSON.stringify({ success: true, item, claimer }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      } catch (error) {
        console.error('[Error] Error claiming item:', error.message, error.stack);
        return new Response(JSON.stringify({ 
          error: 'Failed to claim item',
          details: error.message 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    // GET /api/claims - Get all claims
    if (url.pathname === '/api/claims' && request.method === 'GET') {
      try {
        console.log('[Debug] Fetching all claims');
        const claims = await env.CLAIMS.list();
        const result = {};
        for (const key of claims.keys) {
          result[key.name] = await env.CLAIMS.get(key.name);
        }
        console.log('[Debug] Retrieved claims:', result);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      } catch (error) {
        console.error('[Error] Error fetching claims:', error.message, error.stack);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch claims',
          details: error.message 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    // If API route not found
    console.log('[Debug] API endpoint not found:', url.pathname);
    return new Response(JSON.stringify({ error: 'API endpoint not found' }), { 
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Error] Worker error:', error.message, error.stack);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      availableBindings: Object.keys(env)
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
} 