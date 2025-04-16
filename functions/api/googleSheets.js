import { generateId, maskEmail } from './utils';

export async function getGoogleAccessToken(serviceAccount) {
  // Create JWT header and payload
  const header = {
    // For Google Service Account authentication, we must use RS256 (asymmetric key, not HS256 (symmetric key))
    // with the private key from the service account.
    alg: 'RS256',
    typ: 'JWT',
    kid: serviceAccount.private_key_id
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  // Base64url encode header and payload
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Convert PEM to ArrayBuffer
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\n/g, '');
  
  const binaryDer = atob(pemContents);
  const binaryDerBuffer = new ArrayBuffer(binaryDer.length);
  const binaryDerArray = new Uint8Array(binaryDerBuffer);
  for (let i = 0; i < binaryDer.length; i++) {
    binaryDerArray[i] = binaryDer.charCodeAt(i);
  }

  // Import key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDerBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const textEncoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    textEncoder.encode(`${encodedHeader}.${encodedPayload}`)
  );

  // Convert signature to base64url
  const signatureArray = new Uint8Array(signatureBuffer);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  const encodedSignature = signatureBase64
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Combine to create JWT
  const jwt = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  // Get access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('[Error] Failed to get access token:', error);
    throw new Error('Failed to get access token: ' + error);
  }

  const { access_token } = await tokenResponse.json();
  return access_token;
}

export async function fetchFromGoogleSheets(env) {
  try {
    const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    
    // Fetch data from Google Sheets
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${env.GOOGLE_SHEET_RANGE}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Error] Failed to fetch data from Google Sheets:', error);
      throw new Error('Failed to fetch data from Google Sheets: ' + error);
    }

    const data = await response.json();
    if (!data.values) {
      console.error('[Error] No values returned from Google Sheets:', data);
      throw new Error('No values returned from Google Sheets');
    }
    
    console.log('[Debug] Raw values from Google Sheets:', data.values);
    return transformSheetDatatoItems(data.values);
  } catch (error) {
    console.error('[Error] Error in fetchFromGoogleSheets:', error);
    throw error;
  }
}

export function transformSheetDatatoItems(values) {
  console.log('[Debug] Raw values from Google Sheets:', values);
  console.log('[Debug] Headers:', values[0]);
  
  // Skip header row
  const items = values.slice(1).map(row => {
    const item = {
      id: row[0] || generateId(row[1]), // Use ID if available, otherwise generate from product name
      product: row[1],
      productZH: row[2],
      category: row[3],
      subcategory: row[4],
      price: row[5],
      imageUrl: row[6],
      url: row[7],
      claimedBy: row[8] || '',
      claimerEmail: row[9] ? maskEmail(row[9]) : '' // Mask email before sending to frontend
    };
    console.log('[Debug] Transformed item:', item);
    return item;
  });
  
  return items;
} 