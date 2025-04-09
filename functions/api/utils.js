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