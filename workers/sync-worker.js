import { getGoogleAccessToken } from '../functions/api/googleSheets.js';

export default {
  async scheduled(event, env, ctx) {
    try {
      console.log("Starting sync process");
      return await handleSync(env);
    } catch (error) {
      console.error("Sync failed:", error);
      return { success: false, error: error.message };
    }
  }
};

async function handleSync(env) {
  const start = Date.now();
  let success = true;
  let errorMessage = '';
  let stats = {
    kvTotal: 0,
    sheetTotal: 0,
    updatedInKV: 0,
    updaetdInSheet: 0
  }

  try {
    // 1. Fetch all claims from KV
    console.log("Fetching KV claims");
    const kvClaims = await getAllKVClaims(env.CLAIMS);
    stats.kvTotal = Object.keys(kvClaims).length;

    // 2. Fetch all claims from Google Sheets
    console.log("Fetching Google Sheet claims");
    const sheetClaims = await fetchSheetData(env.GOOGLE_SHEET_ID, env.GOOGLE_SERVICE_ACCOUNT_KEY);
    stats.sheetTotal = Object.keys(sheetClaims).length;

    // 3. Compare and resolve conflicts
    console.log("Reconciling data");
    const { toUpdateInKV, toUpdateInSheet } = reconcileData(kvClaims, sheetClaims);

    // 4. Apply updates
    if (toUpdateInKV.length > 0) {
      console.log(`Updating ${toUpdateInKV.length} items in KV`);
      stats.updatedInKV = await updateKV(env.CLAIMS, toUpdateInKV);
    }

    if (toUpdateInSheet.length > 0) {
      console.log(`Updating ${toUpdateInSheet.length} items in Google Sheet`);
      stats.updatedInSheet = await updateSheet(env.GOOGLE_SHEET_ID, env.GOOGLE_SERVICE_ACCOUNT_KEY, toUpdateInSheet);
    }

  } catch (error) {
    success = false;
    errorMessage = error.message;
    console.error("Sync failed:", error);
  }

  const duration = Date.now() - start;

  await logSyncResults(env.SHEET_ID, env.GOOGLE_SERVICE_ACCOUNT, {
    timestamp: new Date().toISOString(),
    success,
    duration,
    errorMessage,
    stats
  });

  return { 
    success, 
    duration,
    error: errorMessage || undefined,
    stats
  };
}

// Add a log entry to the Logs sheet
async function logSyncResults(sheetId, serviceAccountJson, logData) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    
    // Format the log entry
    const logRow = [
      logData.timestamp,                                    // Timestamp
      logData.success ? 'SUCCESS' : 'FAILURE',              // Status
      logData.stats.kvTotal,                                // KV Total Items
      logData.stats.sheetTotal,                             // Sheet Total Items
      logData.stats.updatedInKV,                            // Items Updated in KV
      logData.stats.updatedInSheet,                         // Items Updated in Sheet
      logData.duration + 'ms',                              // Duration
      logData.errorMessage || ''                            // Error (if any)
    ];
    
    // Append to the Logs sheet
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Logs!A:H:append?valueInputOption=USER_ENTERED`;
    await fetch(appendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [logRow]
      })
    });
    
    console.log("Sync log saved to Google Sheet");
  } catch (error) {
    // Don't let logging errors affect the main process
    console.error("Failed to save sync log:", error);
  }
}

// Fetch all claims from KV namespace
async function getAllKVClaims(claimsKV) {
  // KV doesn't have a native "list all" so we need to use list + get
  const claims = {};
  let cursor;
  
  do {
    const listResult = await claimsKV.list({ cursor });
    cursor = listResult.cursor;
    
    // Get each value - batch for efficiency
    const values = await Promise.all(
      listResult.keys.map(async (key) => {
        const value = await claimsKV.get(key.name, { type: "json" });
        return { key: key.name, value };
      })
    );
    
    values.forEach(({ key, value }) => {
      if (value) claims[key] = {
        ...value,
        source: "kv",
        lastModified: value.lastModified || Date.now() // Fallback if no timestamp
      };
    });
  } while (cursor);
  
  return claims;
}

// Fetch claims data from Google Sheet
async function fetchSheetData(sheetId, serviceAccountJson) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    
    // Fetch data from Google Sheets
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/API!A2:L`;
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
    
    const claims = {};
    const rows = data.values || [];
    
    rows.forEach(row => {
      if (row[0]) { // Item ID exists
        claims[row[0]] = {
          itemId: row[0],
          claimer: row[8] || '',
          email: row[9] || '',
          verified: row[10] === 'TRUE',
          lastModified: parseInt(row[11]) || Date.now(),
          source: "sheet"
        };
      }
    });
    
    return claims;
  } catch (error) {
    console.error('[Error] Error in fetchSheetData:', error);
    throw error;
  }
}

// Reconcile data between KV and Sheets
function reconcileData(kvClaims, sheetClaims) {
  const toUpdateInKV = [];
  const toUpdateInSheet = [];
  
  // Check all items in KV against Sheet
  Object.entries(kvClaims).forEach(([itemId, kvClaim]) => {
    const sheetClaim = sheetClaims[itemId];
    
    if (!sheetClaim) {
      // Item exists in KV but not in Sheet - add to sheet
      toUpdateInSheet.push({
        ...kvClaim,
        itemId
      });
    } else if (sheetClaim.lastModified > kvClaim.lastModified) {
      // Sheet has newer data - update KV
      toUpdateInKV.push({
        itemId,
        value: {
          ...sheetClaim,
          lastModified: sheetClaim.lastModified
        }
      });
    } else if (kvClaim.lastModified > sheetClaim.lastModified) {
      // KV has newer data - update Sheet
      toUpdateInSheet.push({
        ...kvClaim,
        itemId
      });
    }
  });
  
  // Check items in Sheet not in KV
  Object.entries(sheetClaims).forEach(([itemId, sheetClaim]) => {
    if (!kvClaims[itemId]) {
      // Item exists in Sheet but not in KV - add to KV
      toUpdateInKV.push({
        itemId,
        value: {
          ...sheetClaim,
          lastModified: sheetClaim.lastModified
        }
      });
    }
  });
  
  return { toUpdateInKV, toUpdateInSheet };
}

// Update KV namespace with new/updated items
async function updateKV(claimsKV, toUpdate) {
  let updateCount = 0;
  
  await Promise.all(toUpdate.map(async ({ itemId, value }) => {
    try {
      await claimsKV.put(itemId, JSON.stringify(value));
      updateCount++;
    } catch (error) {
      console.error(`Failed to update KV for item ${itemId}:`, error);
    }
  }));
  
  return updateCount;
}

// Update Google Sheet with new/updated items
async function updateSheet(sheetId, serviceAccountJson, toUpdate) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);
    
    // First, get the current sheet data to find row numbers
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/API!A2:A`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${await response.text()}`);
    }
    
    const data = await response.json();
    const rows = data.values || [];
    
    // Map item IDs to row numbers
    const itemIdToRow = {};
    rows.forEach((row, index) => {
      if (row[0]) {
        itemIdToRow[row[0]] = index + 2; // +2 because we start at A2
      }
    });
    
    const updates = [];
    const appendValues = [];
    
    // Prepare updates and appends
    toUpdate.forEach(item => {
      const rowData = [
        item.itemId,
        "",  // Other fields as needed
        "",
        "",
        "",
        "",
        "",
        "",
        item.claimer || "",
        item.email || "",
        item.verified ? "TRUE" : "FALSE",
        item.lastModified
      ];
      
      if (itemIdToRow[item.itemId]) {
        // Update existing row
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/API!A${itemIdToRow[item.itemId]}:L${itemIdToRow[item.itemId]}?valueInputOption=USER_ENTERED`;
        updates.push(
          fetch(updateUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              values: [rowData]
            })
          })
        );
      } else {
        // Add to appends for new rows
        appendValues.push(rowData);
      }
    });
    
    // Process all updates in parallel
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    // Append new rows if any
    if (appendValues.length > 0) {
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/API!A:L:append?valueInputOption=USER_ENTERED`;
      await fetch(appendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: appendValues
        })
      });
    }
    
    return updates.length + appendValues.length;
  } catch (error) {
    console.error("Failed to update sheet:", error);
    throw error;
  }
}
