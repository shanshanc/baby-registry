// Default configuration that will be overridden by API values
export const CONFIG = {
  // Default refresh interval in milliseconds (fallback if API config fails)
  // The actual value is set by the API at /api/config
  // - Current API setting: 60s for development
  // - For production: Consider 30s
  refreshInterval: 60000, // This is just a fallback default
  api: {
    endpoints: {
      items: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') 
            ? 'http://localhost:8787/items' 
            : '',
      config: '/api/config'
    }
  }
};

// Debug mode flag - automatically true in development, false in production
export const DEBUG_MODE = (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.includes('.local') ||
  window.location.hostname.includes('staging') ||
  window.location.protocol === 'file:' ||
  window.location.search.includes('debug=true')
);

export const MESSAGES = {
  errors: {
    generic: '載入清單時發生錯誤，請重新整理頁面。',
    rateLimit: '抱歉，目前流量過大，請稍候5分鐘再試，謝謝您的體諒。'
  },
  priceInfo: '實際價格以產品頁為準'
};
