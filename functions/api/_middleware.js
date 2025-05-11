import { corsHeaders, errorResponse, RateLimiter } from './utils';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  
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
    // Check rate limit
    const rateLimiter = new RateLimiter(env);
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    const isLimited = await rateLimiter.isRateLimited(clientIP, url.pathname);
    
    if (isLimited) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        code: 429,
        retryAfter: 300
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '300'
        }
      });
    }

    // Route handling
    if (url.pathname === '/api/config' && request.method === 'GET') {
      // Return configuration values from environment
      return new Response(JSON.stringify({
        itemsEndpoint: env.BASE_URL_ITEMS_DEV || env.BASE_URL_ITEMS_PROD,
        refreshInterval: 30000
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // If no route matches, return 404
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Error] Request handling failed:', error);
    return errorResponse('Internal server error');
  }
}
