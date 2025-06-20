import { CONFIG } from './constants.js';

// Stores the loaded translations
let translations = {};

// Function to load the zh-TW translations
export async function loadTranslations() {
  try {
    const response = await fetch('/locales/zh-TW.json');
    if (response.ok) {
      translations = await response.json();
    } else {
      console.warn('Failed to load zh-TW.json translations');
    }
  } catch (error) {
    console.error('Error loading zh-TW.json:', error);
  }
}

// Translate function that takes a key (e.g., Category.Feeding or Subcategory.FEED_None)
export function translate(key) {
  const keys = key.split('.');
  let result = translations;
  for (const k of keys) {
    result = result?.[k];
    if (result === undefined) {
      console.warn(`Translation not found for key: ${key}`);
      return key; // Return the key itself if translation is not found
    }
  }
  return result || key; // Return the key if translation is empty string
}

// Fetch configuration from API
export async function loadConfig() {

  try {
    const response = await fetch(CONFIG.api.endpoints.config);
    if (response.ok) {
      const config = await response.json();
      // Update CONFIG with values from API
      if (config.itemsEndpoint) {
        CONFIG.api.endpoints.items = config.itemsEndpoint;
      }
      if (config.refreshInterval) {
        CONFIG.refreshInterval = config.refreshInterval;
      }
      
      // Update personal information in the DOM
      if (config.shippingAddress) {
        const shippingElement = document.getElementById('shipping-address');
        if (shippingElement) {
          shippingElement.textContent = config.shippingAddress;
        }
      }
      
      if (config.bankAccount) {
        const bankAccountElement = document.getElementById('bank-account');
        if (bankAccountElement) {
          bankAccountElement.textContent = config.bankAccount;
        }
      }
    } else {
      console.warn('Failed to load configuration from API, using defaults');
      // Set fallback text for personal information
      setFallbackPersonalInfo();
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
    // Set fallback text for personal information
    setFallbackPersonalInfo();
  }
}

// Set fallback text when configuration loading fails
function setFallbackPersonalInfo() {
  const shippingElement = document.getElementById('shipping-address');
  if (shippingElement) {
    shippingElement.textContent = '新北市新店區碧潭和美山登山步道旁';
  }
  
  const bankAccountElement = document.getElementById('bank-account');
  if (bankAccountElement) {
    bankAccountElement.textContent = '';
  }
}

// Sanitize user input to prevent XSS attacks
export function sanitizeInput(input) {
    if (!input) return '';
    const str = String(input);
    
    // Replace HTML special characters with their entity equivalents
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
