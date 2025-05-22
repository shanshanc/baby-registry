import { CONFIG } from './constants.js';

// Stores the loaded translations
let translations = {};
// Stores the current language, defaults to 'zh'
let currentLanguage = 'zh-TW';

// Function to load a language file
export async function loadLanguage(lang) {
  try {
    const response = await fetch(`/locales/${lang}.json`);
    if (response.ok) {
      translations = await response.json();
      currentLanguage = lang;
      console.log(`${lang.toUpperCase()} translations loaded.`);
    } else {
      console.warn(`Failed to load ${lang}.json, falling back to previous or default.`);
    }
  } catch (error) {
    console.error(`Error loading ${lang}.json:`, error);
  }
}

// Function to set the current language
export function setLanguage(lang) {
  if (lang !== currentLanguage) {
    return loadLanguage(lang);
  }
  return Promise.resolve(); // Language is already set
}

// Function to get the current language
export function getLanguage() {
  return currentLanguage;
}

// Translate function that takes a key (e.g., Category.Feeding or Subcategory.FEED_None)
export function translate(key) {
  const keys = key.split('.');
  let result = translations;
  for (const k of keys) {
    result = result?.[k];
    if (result === undefined) {
      console.warn(`Translation not found for key: ${key} in ${currentLanguage}`);
      return key; // Return the key itself if translation is not found
    }
  }
  return result || key; // Return the key if translation is empty string
}

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
