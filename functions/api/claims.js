import { maskEmail, errorResponse, successResponse } from './utils';
import { handleCreateVerification } from './verificationHandler';

export async function handleGetClaims(env) {
  try {
    const claims = await env.CLAIMS.list();
    
    const result = {};
    
    for (const key of claims.keys) {
      // Skip rate limit keys
      if (key.name.startsWith('ratelimit:')) {
        // console.log('[Debug] Skipping rate limit key:', key.name);
        continue;
      }
      
      // console.log('[Debug] Processing claim key:', key.name);
      const value = await env.CLAIMS.get(key.name);
      // console.log('[Debug] Raw claim value for key', key.name, ':', value);
      
      try {
        // Try to parse as JSON for new claim format
        const claim = JSON.parse(value);
        result[key.name] = {
          claimer: claim.claimer,
          email: maskEmail(claim.email),
          verified: claim.verified || false,
          product: claim.product || '',
          timestamp: claim.timestamp || Date.now()
        };
      } catch (e) {
        console.log('[Debug] Failed to parse claim as JSON for key', key.name, ':', e);
        // If parsing fails, it's an old format claim with just the name
        result[key.name] = {
          claimer: value,
          email: '',
          verified: false,
          product: '',
          timestamp: Date.now()
        };
      }
    }
    
    return successResponse(result);
  } catch (error) {
    console.error('[Error] Error fetching claims:', error);
    return errorResponse('Failed to fetch claims');
  }
}

export async function handlePostClaim(request, env) {
  try {
    const body = await request.json();
    
    const { item, claimer, email } = body;
    if (!item || !claimer || !email) {
      return errorResponse('Missing required fields: item, claimer, and email', 400);
    }
    
    // Store the claim
    const claimData = {
      claimer,
      email,
      verified: false, // New field to track verification status
      product: item, // Product id
      timestamp: Date.now()
    };
    
    const claimJson = JSON.stringify(claimData);
    
    // Verify the claim was stored correctly
    await env.CLAIMS.put(item, claimJson);
    const storedValue = await env.CLAIMS.get(item);
    
    if (storedValue !== claimJson) {
      return errorResponse('Failed to store claim', 500);
    }
    
    console.log('[Debug] Successfully stored claim');

    // Create verification token and send verification email
    const verificationPayload = {
      itemId: item,
      email,
      itemName: item || 'Baby Registry Item'
    };
    
    console.log('[Debug] Creating verification with payload:', verificationPayload);
    
    try {
      // Pass the payload and the env
      const verificationResponse = await handleCreateVerification(verificationPayload, env);
      
      if (!verificationResponse.ok) {
        const verificationText = await verificationResponse.text();
        console.error('[Error] Failed to create verification:', verificationText);
        // Don't fail the claim if verification fails, just log the error
      } else {
        // Log success
        console.log('[Debug] Verification email sent successfully');
      }
    } catch (verificationError) {
      console.error('[Error] Exception during verification:', verificationError);
      // Don't fail the claim if verification fails, just log the error
    }
    
    return successResponse({ 
      success: true, 
      item, 
      claimer, 
      email: maskEmail(email),
      needsVerification: true
    });
  } catch (error) {
    console.error('[Error] Error claiming item:', error);
    return errorResponse('Failed to claim item');
  }
} 