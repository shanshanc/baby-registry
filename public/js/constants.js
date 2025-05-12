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

export const MESSAGES = {
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

export const DONATE_QR_FALLBACK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPwAAAD+CAYAAAAeY2hsAAAMTmlDQ1BJQ0MgUHJvZmlsZQAASImVVwdYU8kWnltSIQQIREBK6E0QkRJASggtgPQuKiEJEEqMCUHFjiyu4NpFBMuKroIoWFZAFhvqqiuLYu+LBRVlXVwXu/ImBNBlX/nefN/c+e8/Z/4559y5d+4AQO/iS6W5qCYAeZJ8WUywPyspOYVF6gEo0AUkYAwQvkAu5URFhQNYhtu/l9fXAKJsLzsotf7Z/1+LllAkFwCAREGcLpQL8iD+EQC8VSCV5QNAlELefFa+VInXQawjgw5CXKPEmSrcqsTpKnxx0CYuhgvxIwDI6ny+LBMAjT7IswoEmVCHDqMFThKhWAKxH8Q+eXkzhBAvgtgG2sA56Up9dvpXOpl/00wf0eTzM0ewKpbBQg4Qy6W5/Dn/Zzr+d8nLVQzPYQ2repYsJEYZM8zbo5wZYUqsDvFbSXpEJMTaAKC4WDhor8TMLEVIvMoetRHIuTBngAnxJHluLG+IjxHyA"; 