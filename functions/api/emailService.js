// Initialize SendGrid with API key
export function initEmailService(apiKey) {
  if (!apiKey) {
    throw new Error('SendGrid API key is required');
  }
  return apiKey;
}

// Send verification email
export async function sendVerificationEmail(email, itemName, verificationLink, apiKey) {
  const msg = {
    personalizations: [{ to: [{ email: email }] }],
    from: { email: 'service@daphne-hsin-baby-registry.me' }, // This needs to be a verified sender in SendGrid
    subject: 'Verify your baby registry claim',
    content: [
      {
        type: 'text/plain',
        value: `Hello,\n\nPlease verify your claim for ${itemName} by clicking the link below:\n\n${verificationLink}\n\nThis link will expire in 24 hours.\n\nThank you!`
      },
      {
        type: 'text/html',
        value: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify Your Baby Registry Claim</h2>
            <p>Hello there,</p>
            <p>Please verify your claim for <strong>${itemName}</strong> by clicking the button below:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${verificationLink}" 
                 style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Verify Claim
              </a>
            </div>
            <p>This link will expire in 24 hours.</p>
            <p>Thank you!<br>Daphne & Hsin</p>
          </div>
        `
      }
    ]
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(msg)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    return { success: true };
  } catch (error) {
    console.error('[Error] Failed to send verification email:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Send claim confirmation email
export async function sendClaimConfirmationEmail(email, itemName, apiKey) {
  const msg = {
    personalizations: [{ to: [{ email: email }] }],
    from: { email: 'service@daphne-hsin-baby-registry.me' }, // Using the same verified sender
    subject: 'Your baby registry claim has been confirmed',
    content: [
      {
        type: 'text/plain',
        value: `Hello,\n\nYour claim for ${itemName} has been confirmed. Thank you for participating in the baby registry!\n\nBest regards,\nBaby Registry Team`
      },
      {
        type: 'text/html',
        value: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Claim Confirmed</h2>
            <p>Hello there,</p>
            <p>Your claim for <strong>${itemName}</strong> has been confirmed.</p>
            <p>Thank you for participating in the baby registry!</p>
            <p>Best regards,<br>Daphne & Hsin</p>
          </div>
        `
      }
    ]
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(msg)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    return { success: true };
  } catch (error) {
    console.error('[Error] Failed to send confirmation email:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
} 