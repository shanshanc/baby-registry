import { errorResponse, successResponse } from './utils';
import { fetchFromGoogleSheets } from './googleSheets';

export async function handleGetItems(env) {
  try {
    // Fetch real data from Google Sheets
    const items = await fetchFromGoogleSheets(env);
    
    // Sync KV with Google Sheets data
    try {
      await syncClaimsWithGoogleSheets(items, env);
    } catch (syncError) {
      console.error('[Error] Failed to sync KV with Google Sheets:', syncError);
      // Continue with returning items even if sync fails
    }
    
    return successResponse(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    return errorResponse('Failed to fetch registry items');
  }
}

async function syncClaimsWithGoogleSheets(items, env) {
  console.log('[Debug] Starting syncClaimsWithGoogleSheets');
  // Get all current claims
  const claims = await env.CLAIMS.list();
  console.log('[Debug] Current claims in KV before sync:', claims.keys.map(k => k.name));
  const currentClaimKeys = claims.keys.map(k => k.name);
  
  // Create a set of item IDs from Google Sheets for faster lookup
  const sheetItemIds = new Set(items.map(item => item.id));
  console.log('[Debug] Items in Google Sheets:', Array.from(sheetItemIds));
  
  // For each item from Google Sheets
  for (const item of items) {
    const itemId = item.id;
    console.log('[Debug] Processing item:', itemId);
    
    // If item has claimedBy/email in Google Sheets, update KV
    if (item.claimedBy && item.claimerEmail) {
      console.log('[Debug] Updating claim for item:', itemId);
      await env.CLAIMS.put(itemId, JSON.stringify({ 
        claimer: item.claimedBy, 
        email: item.claimerEmail,
        verified: true, // Mark as verified since it's from Google Sheets
        product: itemId,
        timestamp: Date.now()
      }));
    }
  }
  
  // Only delete claims for items that no longer exist in Google Sheets
  // and are not recently claimed (within last 24 hours)
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  for (const key of currentClaimKeys) {
    if (!sheetItemIds.has(key)) {
      console.log('[Debug] Checking if claim should be deleted:', key);
      const claimData = await env.CLAIMS.get(key);
      try {
        const claim = JSON.parse(claimData);
        // Only delete if the claim is older than 24 hours
        if (now - claim.timestamp > oneDay) {
          console.log('[Debug] Deleting old claim for item:', key);
          await env.CLAIMS.delete(key);
        } else {
          console.log('[Debug] Keeping recent claim for item:', key);
        }
      } catch (e) {
        console.log('[Debug] Error parsing claim data for item:', key, e);
        // If we can't parse the claim data, keep it
        console.log('[Debug] Keeping unparseable claim for item:', key);
      }
    }
  }
  
  console.log('[Debug] Sync completed');
}

function transformSheetDatatoItems(values) {
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