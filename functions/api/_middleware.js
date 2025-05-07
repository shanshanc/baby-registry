import { corsHeaders, errorResponse, RateLimiter } from './utils';
import { handleGetClaims, handlePostClaim } from './claims';
import { handleGetItems } from './items';
import { handleTestEmail } from './testEmail';
import { handleVerifyToken, handleResendVerification } from './verification';
import { handleCreateVerification } from './verificationHandler';
import { onRequestPost as handleCleanup } from './cleanup';

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
    // Verify KV binding
    if (!env.CLAIMS) {
      console.error('[Error] CLAIMS binding not found in env');
      return errorResponse('KV binding not configured', 500);
    }

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
    if (url.pathname === '/api/items' && request.method === 'GET') {
      return handleGetItems(env);
    } else if (url.pathname === '/api/claims' && request.method === 'GET') {
      // List all keys in CLAIMS namespace for debugging
      const claims = await env.CLAIMS.list();
      console.log('[Debug] All keys in CLAIMS namespace:', claims.keys.map(k => k.name));
      return handleGetClaims(env);
    } else if (url.pathname === '/api/claim' && request.method === 'POST') {
      return handlePostClaim(request, env);
    } else if (url.pathname === '/api/test-email' && request.method === 'POST') {
      return handleTestEmail(request, env);
    } else if (url.pathname === '/api/verify/create' && request.method === 'POST') {
      return handleCreateVerification(request, env);
    } else if (url.pathname === '/api/verify/token' && request.method === 'POST') {
      return handleVerifyToken(request, env);
    } else if (url.pathname === '/api/verify/resend' && request.method === 'POST') {
      return handleResendVerification(request, env);
    } else if (url.pathname === '/api/cleanup' && request.method === 'POST') {
      return handleCleanup(context);
    } else if (url.pathname === '/api/verify' && request.method === 'GET') {
      // Handle verification page requests
      const token = url.searchParams.get('token');
      if (!token) {
        return errorResponse('Token is required', 400);
      }
      return handleVerifyToken(request, env);
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