import { errorResponse, successResponse } from './utils.js';
import { sendVerificationEmail, sendClaimConfirmationEmail } from './emailService.js';

// Verify a token
export async function handleVerifyToken(request, env) {
  try {
    // Get token from either POST body or URL params
    let token;
    if (request.method === 'POST') {
      const body = await request.json();
      token = body.token;
    } else if (request.method === 'GET') {
      const url = new URL(request.url);
      token = url.searchParams.get('token');
    }
    
    console.log('[Debug] Verifying token:', token);
    
    if (!token) {
      return errorResponse('Token is required', 400);
    }

    // Get token data from KV
    const tokenData = await env.VERIFICATION_TOKENS.get(token);
    console.log('[Debug] Token data:', tokenData);
    
    if (!tokenData) {
      return errorResponse('Invalid or expired token', 400);
    }

    const { itemId, email, expiresAt } = JSON.parse(tokenData);
    console.log('[Debug] Token details:', { itemId, email, expiresAt });

    // Check if token is expired
    if (Date.now() > expiresAt) {
      console.log('[Debug] Token expired');
      await env.VERIFICATION_TOKENS.delete(token);
      return errorResponse('Token has expired', 400);
    }

    // Get the claim from KV
    const claimData = await env.CLAIMS.get(itemId);
    console.log('[Debug] Claim data:', claimData);
    
    if (!claimData) {
      return errorResponse('Claim not found', 404);
    }

    let claim;
    try {
      claim = JSON.parse(claimData);
      console.log('[Debug] Parsed claim:', claim);
    } catch (e) {
      console.log('[Debug] Failed to parse claim:', e);
      // If parsing fails, it's an old format claim
      claim = {
        claimer: claimData,
        email: email,
        verified: false
      };
    }

    // Verify email matches
    if (claim.email !== email) {
      console.log('[Debug] Email mismatch:', { claimEmail: claim.email, tokenEmail: email });
      return errorResponse('Email does not match claim', 400);
    }

    // Update claim to mark as verified
    claim.verified = true;
    console.log('[Debug] Updating claim:', claim);
    await env.CLAIMS.put(itemId, JSON.stringify(claim));

    // Delete the used token
    await env.VERIFICATION_TOKENS.delete(token);

    // Send confirmation email
    await sendClaimConfirmationEmail(
      email,
      claim.product || 'Baby Registry Item',
      env.SENDGRID_API_KEY
    );

    return successResponse({ 
      message: 'Claim verified successfully',
      itemId,
      email: email // Note: email is already masked in the claim data
    });
  } catch (error) {
    console.error('[Error] Failed to verify token:', error);
    return errorResponse('Failed to verify token');
  }
}

// Resend verification email
export async function handleResendVerification(request, env) {
  try {
    const { itemId } = await request.json();
    
    if (!itemId) {
      return errorResponse('Item ID is required', 400);
    }

    // Get the claim from KV
    const claimData = await env.CLAIMS.get(itemId);
    if (!claimData) {
      return errorResponse('Claim not found', 404);
    }

    let claim;
    try {
      claim = JSON.parse(claimData);
    } catch (e) {
      // If parsing fails, it's an old format claim
      return errorResponse('Cannot resend verification for old format claims', 400);
    }

    // Generate new token
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    // Store new token in KV
    await env.VERIFICATION_TOKENS.put(
      token,
      JSON.stringify({
        itemId,
        email: claim.email,
        expiresAt
      }),
      { expirationTtl: 86400 } // 24 hours in seconds
    );

    // Generate verification link
    const verificationLink = `${request.headers.get('origin')}/verify?token=${token}`;

    // Send verification email
    const emailResult = await sendVerificationEmail(
      claim.email,
      claim.product || 'Baby Registry Item',
      verificationLink,
      env.SENDGRID_API_KEY
    );

    if (!emailResult.success) {
      return errorResponse('Failed to send verification email');
    }

    return successResponse({ 
      message: 'Verification email resent successfully',
      token // For testing purposes only
    });
  } catch (error) {
    console.error('[Error] Failed to resend verification:', error);
    return errorResponse('Failed to resend verification');
  }
}

export async function onRequestPost(context) {
  // Handle POST requests for verification
  return handleVerifyToken(context.request, context.env);
}

export async function onRequestGet(context) {
  // Handle GET requests for verification
  return handleVerifyToken(context.request, context.env);
} 