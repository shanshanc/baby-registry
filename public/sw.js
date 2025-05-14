const CACHE_NAME = 'baby-registry-v1';
const STATIC_CACHE = 'static-v1';
const API_CACHE = 'api-v1';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/constants.js',
  '/js/scripts.js',
  '/js/util.js',
  '/js/modal.js',
  '/js/filter.js',
  '/js/category.js',
  '/js/item.js',
  '/js/itemManager.js',
  '/js/imageOptimizer.js',
  '/js/debug.js',
  '/img/heart.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  // Log for debugging
  console.log('[Service Worker] Installing');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Message event - handle control messages from the client
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Skipping waiting');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        console.log('[Service Worker] Clearing all caches');
        return Promise.all(cacheNames.map(name => caches.delete(name)));
      })
    );
  }
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check for debug mode
  const isDebugMode = url.searchParams.has('debug');
  
  // Skip caching and go network-first in debug mode with cache=false
  if (isDebugMode && url.searchParams.has('cache') && url.searchParams.get('cache') === 'false') {
    console.log('[Service Worker] Debug mode - bypassing cache for:', url.pathname);
    event.respondWith(
      fetch(event.request).catch(error => {
        console.log('[Service Worker] Network error in debug mode:', error);
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/') || url.href.includes('/items')) {
    event.respondWith(handleApiRequest(event.request, isDebugMode));
    return;
  }
  
  // Handle static assets
  event.respondWith(handleStaticRequest(event.request, isDebugMode));
});

// Handle API requests with stale-while-revalidate strategy
async function handleApiRequest(request, isDebugMode) {
  const cache = await caches.open(API_CACHE);
  
  // In debug mode with no special params, we still use stale-while-revalidate
  // but we log more information
  if (isDebugMode) {
    console.log('[Service Worker] API request in debug mode:', request.url);
  }
  
  // Check if this is a GET request - only GET requests can be cached
  const isGetRequest = request.method === 'GET';
  
  // Start fetch in the background right away
  const fetchPromise = fetch(request).then(async (networkResponse) => {
    // Only try to cache GET requests
    if (networkResponse.ok && isGetRequest) {
      // Clone the response before putting it in the cache
      await cache.put(request, networkResponse.clone());
      if (isDebugMode) {
        console.log('[Service Worker] Updated cache for API:', request.url);
      }
    }
    return networkResponse;
  }).catch(error => {
    console.error('[Service Worker] Network request failed, falling back to cache', error);
    return null;
  });
  
  // For non-GET requests, don't try to use the cache
  if (!isGetRequest) {
    if (isDebugMode) {
      console.log('[Service Worker] Non-GET request, not using cache:', request.url);
    }
    const networkResponse = await fetchPromise;
    if (networkResponse) {
      return networkResponse;
    }
    
    // If network fails for non-GET, return error
    return new Response(JSON.stringify({ 
      error: "Network error - unable to process request" 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // For GET requests, try to get from cache while the fetch is happening
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    if (isDebugMode) {
      console.log('[Service Worker] Serving API from cache while fetching update:', request.url);
    }
    // Return cached response immediately
    fetchPromise.catch(() => console.log('[Service Worker] Background fetch failed, but we already served from cache'));
    return cachedResponse;
  }
  
  // If not in cache, wait for the network response
  if (isDebugMode) {
    console.log('[Service Worker] No cached version, waiting for network:', request.url);
  }
  
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }
  
  // If both cache and network fail, return a meaningful error
  return new Response(JSON.stringify({ 
    error: "Network error and no cached version available" 
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle static assets with cache-first strategy
async function handleStaticRequest(request, isDebugMode) {
  const cache = await caches.open(STATIC_CACHE);
  
  // In debug mode, network-first for images to test lazy loading
  if (isDebugMode && request.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
    if (isDebugMode) {
      console.log('[Service Worker] Image request in debug mode, network-first:', request.url);
    }
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      console.log('[Service Worker] Network failed for image in debug mode, using cache');
      return cache.match(request);
    }
  }
  
  // Regular cache-first for other static assets
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    if (isDebugMode) {
      console.log('[Service Worker] Serving from cache:', request.url);
    }
    return cachedResponse;
  }
  
  try {
    if (isDebugMode) {
      console.log('[Service Worker] Not in cache, fetching from network:', request.url);
    }
    
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // If network fails and no cache, return offline page
    console.log('[Service Worker] Both network and cache failed');
    return caches.match('/offline.html');
  }
} 