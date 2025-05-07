// CORS headers configuration
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Email masking utility
export function maskEmail(email) {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = localPart.length > 2 
    ? `${localPart.slice(0, 2)}${'*'.repeat(localPart.length - 2)}`
    : localPart;
  return `${maskedLocal}@${domain}`;
}

// ID generation utility
export function generateId(itemName) {
  return itemName.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Error response helper
export function errorResponse(error, status = 500) {
  return new Response(
    JSON.stringify({ 
      error: error.message || error,
      details: error.stack
    }), 
    { 
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Success response helper
export function successResponse(data) {
  return new Response(
    JSON.stringify(data),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

export class RateLimiter {
  constructor(env) {
    this.kv = env.RATE_LIMIT; // Use separate KV namespace for rate limiting
    // Check if we're in development
    this.isDev = env.NODE_ENV === 'development' || !env.PROD;
  }

  async isRateLimited(ip, endpoint) {
    const now = Date.now();
    // Minimum window of 60 seconds for dev due to KV TTL limitation
    const windowSize = this.isDev ? 60 * 1000 : 5 * 60 * 1000; // 60 seconds in dev, 5 minutes in prod
    const limit = this.isDev 
      ? (endpoint === '/api/items' ? 20 : 30)  // Smaller limits for testing
      : (endpoint === '/api/items' ? 30 : 50); // Production limits
    
    const key = `ratelimit:${ip}:${endpoint}`;
    const value = await this.kv.get(key);
    const requests = value ? JSON.parse(value) : [];
    
    // Clean old requests
    const validRequests = requests.filter(timestamp => now - timestamp < windowSize);
    
    if (validRequests.length >= limit) {
      console.log(`[Rate Limit] IP ${ip} exceeded limit for ${endpoint}. Requests: ${validRequests.length}/${limit}`);
      return true;
    }
    
    // Add current request
    validRequests.push(now);
    const ttl = this.isDev ? 60 : 300; // 60 seconds TTL in dev (minimum allowed), 5 minutes in prod
    await this.kv.put(key, JSON.stringify(validRequests), { expirationTtl: ttl });
    
    return false;
  }
}
 