import { CONFIG } from './constants.js';

// Fetch configuration from API
export async function loadConfig() {
  console.log('Loading configuration...');
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
      console.log('Configuration loaded from API:', CONFIG);
    } else {
      console.warn('Failed to load configuration from API, using defaults');
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
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
