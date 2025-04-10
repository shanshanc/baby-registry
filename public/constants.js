const CONFIG = {
  refreshInterval: 30000, // Claims refresh interval in milliseconds
  api: {
    endpoints: {
      items: '/api/items',
      claims: '/api/claims',
      claim: '/api/claim'
    }
  }
};

const MESSAGES = {
  errors: {
    generic: {
      en: 'Error loading registry. Please refresh the page.',
      zh: '載入清單時發生錯誤，請重新整理頁面。'
    },
    rateLimit: {
      en: 'To ensure a fair experience for all users, we need to limit requests. Please wait 5 minutes before trying again.',
      zh: '抱歉，目前流量過大，請稍候5分鐘再試，謝謝您的體諒。'
    },
    claim: {
      en: 'Failed to claim item. Please try again.',
      zh: '認領失敗，請再試一次。'
    },
    emailRequired: {
      en: 'Please provide your email address',
      zh: '請提供您的電子郵件'
    }
  },
  placeholders: {
    takenBy: 'Taken by / 認領者',
    email: 'Your email / 電子郵件'
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