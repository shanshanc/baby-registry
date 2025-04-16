import { sendVerificationEmail } from './emailService.js';

// Token expiration time (24 hours in milliseconds)
const TOKEN_EXPIRATION = 24 * 60 * 60 * 1000;

// Generate a verification token
function generateVerificationToken() {
  return crypto.randomUUID();
}

export async function handleCreateVerification(request, env) {
  try {
    // Parse the request if needed
    let requestData;
    let origin = 'http://localhost:8788'; // Default fallback value

    if (request && request.json && typeof request.json === 'function') {
      try {
        requestData = await request.json();
        // Extract origin from headers if available
        if (request.headers && typeof request.headers.get === 'function') {
          origin = request.headers.get('origin') || origin;
        }
      } catch (e) {
        console.error('[Error] Failed to parse request JSON:', e);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      requestData = request; // If request is already the parsed data
      
      // For direct object passing, origin is set to BASE_URL env var or default
      if (env && env.BASE_URL) {
        origin = env.BASE_URL;
      }
    }

    const { email, itemId, itemName } = requestData;
    
    console.log('[Debug] Creating verification for item:', itemId, 'email:', email, 'origin:', origin);
    
    if (!email || !itemId) {
      console.log('[Error] Missing required fields');
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: email and itemId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the claim from KV
    let claimData = await env.CLAIMS.get(itemId);
    if (!claimData) {
      console.log('[Error] Claim not found for item:', itemId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Claim not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse the claim data
    let claim;
    try {
      claim = JSON.parse(claimData);
    } catch (e) {
      console.error('[Error] Failed to parse claim data:', e);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid claim data'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Debug] Claim data:', claim);

    // Check if claim is already verified
    if (claim.verified) {
      console.log('[Error] Claim already verified for item:', itemId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Claim is already verified'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create verification token
    const token = generateVerificationToken();
    const expiresAt = Date.now() + TOKEN_EXPIRATION;

    console.log('[Debug] Generated token:', token);

    // Store verification data in KV with 24-hour expiration
    await env.VERIFICATION_TOKENS.put(
      token,
      JSON.stringify({
        email,
        itemId,
        expiresAt
      }),
      { expirationTtl: 86400 } // 24 hours in seconds
    );

    // Use product name from claim or request if available, otherwise use a default
    const productName = itemName || claim.product || "Baby Registry Item";

    console.log('[Debug] Sending verification email for item:', productName);

    // Generate verification link
    const verificationLink = `${origin}/verify?token=${token}`;
    
    console.log('[Debug] Verification link:', verificationLink);

    // Send verification email
    const emailResult = await sendVerificationEmail(
      email,
      productName,
      verificationLink,
      env.SENDGRID_API_KEY
    );

    if (!emailResult.success) {
      console.error('[Error] Failed to send verification email:', emailResult.error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to send verification email: ' + emailResult.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Debug] Verification email sent successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Verification email sent',
      token: token // Including for testing
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Error] Failed to create verification:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 