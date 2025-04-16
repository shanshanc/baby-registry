// Verification status values
export const VERIFICATION_STATUS = {
  IN_PROCESS: 'InProcess',
  TRUE: 'True',
  FALSE: 'False'
};

// Verification expiry time (24 hours in milliseconds)
export const VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000;

// Google Sheets column indices
export const SHEET_COLUMNS = {
  ID: 0,           // Column A
  PRODUCT: 1,      // Column B
  URL: 2,          // Column C
  CATEGORY: 3,     // Column D
  SUBCATEGORY: 4,  // Column E
  PRICE: 5,        // Column F
  QUANTITY: 6,     // Column G
  CLAIMED_BY: 7,   // Column H
  CLAIMER_EMAIL: 8,// Column I
  NOTES: 9,        // Column J
  VERIFY_STATUS: 10 // Column K
}; 