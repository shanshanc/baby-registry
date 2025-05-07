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
    
    console.log('[Debug] handleVerifyToken token:', token);
    
    if (!token) {
      return handleVerificationError(request, 'Token is required', 400);
    }

    // Get token data from KV
    const tokenData = await env.VERIFICATION_TOKENS.get(token);
    console.log('[Debug] Token data:', tokenData);
    
    if (!tokenData) {
      return handleVerificationError(request, 'Invalid or expired token', 400);
    }

    const { itemId, email, expiresAt } = JSON.parse(tokenData);
    console.log('[Debug] Token details:', { itemId, email, expiresAt });

    // Check if token is expired
    if (Date.now() > expiresAt) {
      console.log('[Debug] Token expired');
      await env.VERIFICATION_TOKENS.delete(token);
      return handleVerificationError(request, 'Token has expired', 400);
    }

    // Get the claim from KV
    const claimData = await env.CLAIMS.get(itemId);
    console.log('[Debug] handleVerifyToken. Claim data:', claimData);
    
    if (!claimData) {
      return handleVerificationError(request, 'Claim not found', 404);
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
      return handleVerificationError(request, 'Email does not match claim', 400);
    }

    // Update claim to mark as verified
    claim.verified = true;
    console.log('[Debug] handleVerifyToken.Updating claim:', claim);
    await env.CLAIMS.put(itemId, JSON.stringify(claim));

    // Delete the used token
    await env.VERIFICATION_TOKENS.delete(token);

    // Send confirmation email
    await sendClaimConfirmationEmail(
      email,
      claim.product || 'Baby Registry Item',
      env.SENDGRID_API_KEY
    );

    // For GET requests (browser verification), return HTML page with redirect
    if (request.method === 'GET') {
      const origin = request.headers.get('origin') || new URL(request.url).origin;
      const homepageUrl = new URL('/', origin).toString();
      
      return new Response(
        `<!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Verification Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 40px 20px;
              max-width: 600px;
              margin: 0 auto;
              line-height: 1.6;
            }
            .success-container {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 30px;
              margin-top: 30px;
              box-shadow: 0 3px 10px rgba(0,0,0,0.1);
            }
            h1 {
              color: #E36C0C;
              margin-bottom: 20px;
            }
            .redirecting {
              margin-top: 20px;
              font-style: italic;
              color: #666;
            }
            .btn {
              display: inline-block;
              background-color: #E36C0C;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 4px;
              margin-top: 20px;
              font-weight: bold;
            }
          </style>
          <meta http-equiv="refresh" content="5;url=${homepageUrl}" />
        </head>
        <body>
          <div class="success-container">
            <h1>Email Verified! Welcome Aboard</h1>
            <p>Thank you for verifying your claim for <strong>${claim.product || 'the product for our lovely little one'}</strong>.</p>
            <p>We've sent a confirmation email to your address.</p>
            <p class="redirecting">You will be redirected to the registry homepage in 5 seconds...</p>
            <a href="${homepageUrl}" class="btn">Go to Registry Now</a>
          </div>
        </body>
        </html>`,
        {
          headers: {
            'Content-Type': 'text/html',
          },
          status: 200,
        }
      );
    }

    // For API calls (POST requests), return JSON response
    return successResponse({ 
      message: 'Claim verified successfully',
      itemId,
      email: email // Note: email is already masked in the claim data
    });
  } catch (error) {
    console.error('[Error] Failed to verify token:', error);
    return handleVerificationError(request, 'Failed to verify token');
  }
}

// Helper function to handle verification errors
function handleVerificationError(request, errorMessage, status = 500) {
  // For GET requests (browser verification), return HTML error page
  if (request.method === 'GET') {
    const origin = request.headers.get('origin') || new URL(request.url).origin;
    const homepageUrl = new URL('/', origin).toString();
    
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Verification Failed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 40px 20px;
            max-width: 600px;
            margin: 0 auto;
            line-height: 1.6;
          }
          .error-container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
            margin-top: 30px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #e74c3c;
            margin-bottom: 20px;
          }
          .redirecting {
            margin-top: 20px;
            font-style: italic;
            color: #666;
          }
          .btn {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 20px;
            font-weight: bold;
          }
        </style>
        <meta http-equiv="refresh" content="10;url=${homepageUrl}" />
      </head>
      <body>
        <div class="error-container">
          <h1>Sorry, Verification Failed</h1>
          <p>We were unable to verify your claim: <strong>${errorMessage}</strong></p>
          <p>You may need to request a new verification link if the previous one has expired.</p>
          <p class="redirecting">You will be redirected to the registry homepage in 10 seconds...</p>
          <a href="${homepageUrl}" class="btn">Go to Registry Now</a>
        </div>
      </body>
      </html>`,
      {
        headers: {
          'Content-Type': 'text/html',
        },
        status,
      }
    );
  }
  
  // For API calls (POST requests), return JSON error
  return errorResponse(errorMessage, status);
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
    const verificationLink = `${request.headers.get('origin')}/api/verify?token=${token}`;

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