const CACHE_NAME = 'baby-registry-v3';
const STATIC_CACHE = 'static-v3';
const API_CACHE = 'api-v3';

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
  '/js/types.js',
  '/js/item.js',
  '/js/itemManager.js',
  '/js/imageOptimizer.js',
  '/js/debug.js',
  '/img/heart.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // Take control of all clients/pages immediately
  event.waitUntil(self.clients.claim());
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Message event - handle control messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
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
  
  // Special handling for images - use network-first approach
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|avif)$/i) || 
      (url.hostname !== self.location.hostname && url.href.match(/\.(jpg|jpeg|png|gif|svg|webp|avif)/i))) {
    event.respondWith(handleImageRequest(event.request, isDebugMode));
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

// Handle image requests with network-first strategy
async function handleImageRequest(request, isDebugMode) {
  const cache = await caches.open(STATIC_CACHE);
  const url = new URL(request.url);
  const isCrossOrigin = url.origin !== self.location.origin;
  
  if (isDebugMode) {
    console.log(`[SW] Image request: ${request.url}`);
  }
  
  // First check if we have a cached version
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    if (isDebugMode) {
      console.log('[SW] Serving image from cache:', request.url);
    }
    return cachedResponse;
  }
  
  try {
    // For cross-origin requests, use different strategies based on domain
    let fetchOptions = {};
    
    if (isCrossOrigin) {
      // For ALL cross-origin image requests, default to no-cors to be safe
      fetchOptions = { mode: 'no-cors', credentials: 'omit' };
      if (isDebugMode) {
        console.log('[SW] Using no-cors for cross-origin image:', url.hostname);
      }
    }
    
    if (isDebugMode) {
      console.log('[SW] Fetching with options:', JSON.stringify(fetchOptions));
    }
    const networkResponse = await fetch(request, fetchOptions);
    
    // Handle different response types
    if (networkResponse.ok || (fetchOptions.mode === 'no-cors' && networkResponse.type === 'opaque')) {
      // Store in cache for later - note that opaque responses from no-cors will have status 0 but are still cacheable
      await cache.put(request, networkResponse.clone());
      if (isDebugMode) {
        console.log('[SW] Successfully cached image:', request.url);
      }
      return networkResponse;
    } else {
      if (isDebugMode) {
        console.warn('[SW] Network response not OK:', networkResponse.status, networkResponse.statusText);
      }
      return networkResponse;
    }
  } catch (error) {
    console.warn('[SW] Network issue for image (will be handled):', error.message);
    
    // If all else fails, return a generic image or error
    return new Response('Image not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

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
  
  // Regular cache-first for static assets
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