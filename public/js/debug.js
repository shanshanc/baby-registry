/**
 * Debug utilities for image optimization testing
 * Only active in development environment or when ?debug=true is in the URL
 */

// Check if we're in debug mode
const isDebugMode = (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.includes('.local') ||
  window.location.hostname.includes('staging') ||
  window.location.protocol === 'file:' ||
  window.location.search.includes('debug=true')
);

// Only initialize debug tools if in debug mode
if (isDebugMode) {
  // Will be populated by the imageOptimizer module
  window.testImageFallbacks = function() {
      console.warn('testImageFallbacks is not ready yet. Try again in a moment.');
  };

  // Will be available immediately
  window.testImageErrorManual = function(selector = '.item-image') {
      const images = document.querySelectorAll(selector);
      let count = 0;
      
      images.forEach(img => {
          // Force using the fallback image by directly setting the src
          if (img.hasAttribute('data-fallback')) {
              const fallback = img.getAttribute('data-fallback');
              img.src = fallback;
              img.classList.remove('lazy-image');
              count++;
          }
      });
      
      console.log(`Applied fallbacks to ${count} images`);
      return `Applied fallbacks to ${count} images`;
  };

  // Function to check which images are lazy-loaded
  window.checkLazyImages = function() {
      const lazyImages = document.querySelectorAll('.lazy-image');
      console.log(`Found ${lazyImages.length} lazy-loaded images:`);
      lazyImages.forEach(img => console.log(img));
      return `Found ${lazyImages.length} lazy-loaded images`;
  };
  
  // Add Service Worker debug tools
  window.swDebug = {
    // Unregister all service workers
    unregister: async function() {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
          console.log('ServiceWorker unregistered:', registration);
        }
        return `Unregistered ${registrations.length} service worker(s)`;
      }
      return 'ServiceWorker API not available';
    },
    
    // Show status of all service workers
    status: async function() {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('Active service workers:', registrations);
        
        let status = '';
        if (registrations.length === 0) {
          status = 'No service workers registered';
        } else {
          status = `${registrations.length} service worker(s) registered\n`;
          registrations.forEach((reg, i) => {
            status += `\n[${i+1}] Scope: ${reg.scope}\n`;
            status += `    Active: ${!!reg.active}\n`;
            status += `    Installing: ${!!reg.installing}\n`;
            status += `    Waiting: ${!!reg.waiting}\n`;
          });
        }
        return status;
      }
      return 'ServiceWorker API not available';
    },
    
    // Clear caches
    clearCaches: async function() {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
        // Also send message to service worker to clear caches
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CLEAR_CACHES'
          });
        }
        return `Cleared ${cacheNames.length} cache(s): ${cacheNames.join(', ')}`;
      }
      return 'Cache API not available';
    },
    
    // Skip waiting
    skipWaiting: async function() {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.waiting) {
          // Send message to service worker
          registration.waiting.postMessage({
            type: 'SKIP_WAITING'
          });
          return 'Skip waiting message sent';
        }
        return 'No waiting service worker found';
      }
      return 'ServiceWorker API not available';
    },
    
    // Force a reload with no service worker caching
    bypassCache: function() {
      const url = new URL(window.location.href);
      url.searchParams.set('debug', 'true');
      url.searchParams.set('cache', 'false');
      console.log('Reloading with cache bypass:', url.toString());
      window.location.href = url.toString();
      return 'Reloading with cache bypass...';
    },
    
    // Get all cached resources
    showCachedResources: async function() {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        
        let results = {};
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          const urls = requests.map(req => req.url);
          results[name] = urls;
        }
        
        console.log('Cached resources:', results);
        return `Found ${Object.keys(results).length} caches. See console for details.`;
      }
      return 'Cache API not available';
    }
  };

  // Show debug commands once when debug mode is detected
  console.group('🛠️ Debug mode active! Available commands:');
  console.log('%c• window.testImageFallbacks() %c- Test image fallback system', 'color: #007acc; font-weight: bold', 'color: #666');
  console.log('%c• window.testImageErrorManual() %c- Manually trigger image errors', 'color: #007acc; font-weight: bold', 'color: #666');
  console.log('%c• window.checkLazyImages() %c- Check lazy loading status', 'color: #007acc; font-weight: bold', 'color: #666');
  console.log('%c• window.swDebug.status() %c- Service Worker status', 'color: #007acc; font-weight: bold', 'color: #666');
  console.log('%c• window.swDebug.unregister() %c- Unregister Service Worker', 'color: #007acc; font-weight: bold', 'color: #666');
  console.log('%c• window.swDebug.clearCaches() %c- Clear all caches', 'color: #007acc; font-weight: bold', 'color: #666');
  console.log('%c• window.swDebug.skipWaiting() %c- Force SW update', 'color: #007acc; font-weight: bold', 'color: #666');
  console.log('%c• window.swDebug.bypassCache() %c- Reload without cache', 'color: #007acc; font-weight: bold', 'color: #666');
  console.log('%c• window.swDebug.showCachedResources() %c- Show cached resources', 'color: #007acc; font-weight: bold', 'color: #666');
  console.groupEnd();
} 