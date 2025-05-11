// Default configuration that will be overridden by API values
const CONFIG = {
  // Refresh interval in milliseconds
  // Considerations:
  // - Too frequent (e.g., 3s): High load on Durable Object, unnecessary updates
  // - Too infrequent (e.g., 60s): Delayed updates for concurrent users
  // - 15s is a good balance between real-time updates and performance
  refreshInterval: 15000,
  api: {
    endpoints: {
      items: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') 
            ? 'http://localhost:8787/items' 
            : '',
      config: '/api/config'
    }
  }
};

// Fetch configuration from API
async function loadConfig() {
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

// Load configuration when the script runs
loadConfig();

const MESSAGES = {
  errors: {
    generic: {
      en: 'Error loading registry. Please refresh the page.',
      zh: '載入清單時發生錯誤，請重新整理頁面。'
    },
    rateLimit: {
      en: 'To ensure a fair experience for all users, we need to limit requests. Please wait 5 minutes before trying again.',
      zh: '抱歉，目前流量過大，請稍候5分鐘再試，謝謝您的體諒。'
    }
  },
  placeholders: {
    takenBy: 'Taken by / 認領者'
  },
  labels: {
    productLink: 'Product Link / 商品連結'
  }
};

// Language utilities
function getCurrentLanguage() {
  // Check localStorage first
  const savedLang = localStorage.getItem('preferredLanguage');
  if (savedLang && Object.values(LANGUAGES).includes(savedLang)) {
    return savedLang;
  }

  // Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) {
    return LANGUAGES.zh;
  }

  return CONFIG.defaultLanguage;
}

function setLanguage(lang) {
  if (Object.values(LANGUAGES).includes(lang)) {
    localStorage.setItem('preferredLanguage', lang);
    return lang;
  }
  return CONFIG.defaultLanguage;
}

function getMessage(messageObj) {
  const currentLang = getCurrentLanguage();
  return messageObj[currentLang] || messageObj[CONFIG.defaultLanguage];
} 