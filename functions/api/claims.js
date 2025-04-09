import { maskEmail, errorResponse, successResponse } from './utils';

export async function handleGetClaims(env) {
  try {
    console.log('[Debug] Fetching all claims');
    const claims = await env.CLAIMS.list();
    const result = {};
    
    for (const key of claims.keys) {
      const value = await env.CLAIMS.get(key.name);
      try {
        // Try to parse as JSON for new claim format
        const claim = JSON.parse(value);
        result[key.name] = {
          ...claim,
          email: maskEmail(claim.email) // Mask email before sending to frontend
        };
      } catch {
        // If parsing fails, it's an old format claim with just the name
        result[key.name] = value;
      }
    }
    
    console.log('[Debug] Retrieved claims:', result);
    return successResponse(result);
  } catch (error) {
    console.error('[Error] Error fetching claims:', error);
    return errorResponse('Failed to fetch claims');
  }
}

export async function handlePostClaim(request, env) {
  try {
    const body = await request.json();
    console.log('[Debug] Claim request body:', body);
    
    const { item, claimer, email } = body;
    if (!item || !claimer || !email) {
      console.log('[Error] Missing required fields:', { item, claimer, email });
      return errorResponse('Missing required fields: item, claimer, and email', 400);
    }
    
    console.log('[Debug] Attempting to store claim:', { item, claimer, email });
    await env.CLAIMS.put(item, JSON.stringify({ claimer, email }));
    console.log('[Debug] Successfully stored claim');
    
    return successResponse({ 
      success: true, 
      item, 
      claimer, 
      email: maskEmail(email) 
    });
  } catch (error) {
    console.error('[Error] Error claiming item:', error);
    return errorResponse('Failed to claim item');
  }
} 