//# allFunctionsCalledOnLoad

import { CONFIG, MESSAGES, DEBUG_MODE } from './constants.js';
import { loadConfig } from './util.js';
import { initModal } from './modal.js';
import { initFilters, filterAndSearchItems, updateControlCheckboxesState } from './filter.js';
import { initCategories } from './category.js';
import { renderItems } from './item.js';
import ItemManager from './itemManager.js';
import { initLazyLoading, testFallbacks, supportsWebP } from './imageOptimizer.js';

function toggleItems(itemEle) {
    // Toggle the selected category header
    const selectedCategory = itemEle.dataset.category;
    itemEle.classList.toggle('active');

    // Toggle the selected subcategory items container
    const subcategoryItems = document.querySelector(`.category-items[data-category="${selectedCategory}"]`);
    if (subcategoryItems) {
        subcategoryItems.classList.toggle('active');
    }

    // Update the master control checkboxes
    updateControlCheckboxesState();
}

// Check if item state has changed compared to last known state
function hasItemStateChanged(items) {
    const currentState = JSON.stringify(items);
    const hasChanged = currentState !== window.lastItemsState;
    
    if (hasChanged) {
        window.lastItemsState = currentState;
    }
    
    return hasChanged;
}

// Main function to update UI with new items data
function updateUIWithItems(items) {
    // Skip update if nothing changed
    if (!hasItemStateChanged(items)) {
        return;
    }

    // Track which items were updated
    const updatedItems = new Set();
    
    // Update each item in the DOM if needed
    items.forEach(item => {
        const itemElement = document.querySelector(`[data-item="${item.id}"]`);
        if (itemElement && ItemManager.updateSingleItemUI(itemElement, item)) {
            updatedItems.add(item.id);
        }
    });
    
    // Log update summary
    if (updatedItems.size > 0) {
        if (DEBUG_MODE) {
            console.log(`Updated ${updatedItems.size} items:`, Array.from(updatedItems));
        }
        // Re-initialize lazy loading after updating items
        initLazyLoading();
    }
    
    // Reapply filters after update
    filterAndSearchItems();
}

async function loadItems() {
    const itemsContainer = document.getElementById('items-container');
    
    try {
        // Set loading state
        itemsContainer.dataset.loading = 'true';
        
        // Try to get cached items first
        const cachedItems = localStorage.getItem('cachedItems');
        const cacheTimestamp = localStorage.getItem('cacheTimestamp');
        const now = Date.now();
        
        const isCacheFresh = cachedItems && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 60000;
        let shouldRenderFromCache = false;
        
        // Use cache if it's less than 1 minute old (reduced from 5 minutes to avoid stale data issues)
        // This helps provide an immediate render while we wait for fresh data
        if (isCacheFresh) {
            shouldRenderFromCache = true;
            const itemsFromCache = JSON.parse(cachedItems);
            // Only render from cache if we have items
            if (itemsFromCache && itemsFromCache.length > 0) {
                // Render items into categories and attach claim listeners
                renderItems(itemsFromCache);
                attachClaimListeners(itemsFromCache);
                
                // Remove loading state since we have something to show
                itemsContainer.dataset.loading = 'false';
                
                // Store initial items state for comparison
                window.lastItemsState = JSON.stringify(itemsFromCache);
            }
        }
        
        // Fetch items from Durable Object - with simple fetch options
        const itemsFromAPI = await getItemsFromAPI();
        const apiItemsState = JSON.stringify(itemsFromAPI);
        
        // Update cache
        localStorage.setItem('cachedItems', apiItemsState);
        localStorage.setItem('cacheTimestamp', now.toString());

        if (DEBUG_MODE) {
            console.log('[Debug] Total items: ', itemsFromAPI.length);
        }
        
        // Only re-render if we didn't render from cache or if the data is different
        const shouldUpdateUI = !shouldRenderFromCache || apiItemsState !== window.lastItemsState;
        if (shouldUpdateUI) {
            window.lastItemsState = apiItemsState;
            
            // Render items into categories and attach claim listeners
            renderItems(itemsFromAPI);
            attachClaimListeners(itemsFromAPI);
            
            // Initialize lazy loading for images
            initLazyLoading();
        }
        
        // Remove loading state
        itemsContainer.dataset.loading = 'false';
        
        // Set up periodic refresh with exponential backoff
        startPeriodicRefresh();
        
    } catch (error) {
        // Remove loading state on error
        itemsContainer.dataset.loading = 'false';
        
        console.error('Error loading registry:', error);
        let errorMessage = '';
        
        // Don't try to parse error messages, just use them directly
        if (error.message) {
            if (error.message.includes('429')) {
                errorMessage = MESSAGES.errors.rateLimit;
            } else {
                errorMessage = `Error: ${error.message}`;
            }
        }
        
        // Fallback if error doesn't have a message
        if (!errorMessage) {
            errorMessage = MESSAGES.errors.generic || "Unknown error occurred";
        }
        
        if (itemsContainer) {
            itemsContainer.innerHTML = `
                <div class="error-message">
                    <p>${errorMessage}</p>
                </div>
            `;
        }
    }
}

async function getItemsFromAPI() {
  const url = new URL(CONFIG.api.endpoints.items);

  const items = await fetch(url, {
      cache: 'no-store',
      mode: 'cors'
  }).then(response => {
      if (!response.ok) {
          return response.json().then(errorData => {
              throw new Error(errorData.message || MESSAGES.errors.generic);
          }).catch(e => {
              throw new Error(`Server error: ${response.status} ${response.statusText}`);
          });
      }
      return response.json();
  });

  return items;
}

function attachClaimListeners(items) {
  if (items && items.length > 0) {
    items.forEach(itemData => {
      const itemElement = document.querySelector(`.item[data-item="${itemData.id}"]`);
      if (itemElement) {
        ItemManager.attachClaimListeners(itemElement, itemData);
      }
    });
  }
}

function startPeriodicRefresh() {
  let retryCount = 0;
  const maxRetryCount = 5;
  const baseInterval = CONFIG.refreshInterval;

  const refreshItems = async () => {
      try {
          const updatedItems = await getItemsFromAPI();
          
          // Reset retry count on successful fetch
          retryCount = 0;
          
          // Update cache
          localStorage.setItem('cachedItems', JSON.stringify(updatedItems));
          localStorage.setItem('cacheTimestamp', Date.now().toString());
          
          updateUIWithItems(updatedItems);
      } catch (error) {
          console.error('Error refreshing items:', error);
          retryCount++;
          
          // Implement exponential backoff
          if (retryCount < maxRetryCount) {
              const backoffDelay = baseInterval * Math.pow(2, retryCount);
              setTimeout(refreshItems, backoffDelay);
          }
      }
  };

  // Start periodic refresh
  setInterval(refreshItems, baseInterval);
}

// Function to handle expand all categories
function handleExpandAllCategories() {
    const collapseAll = document.getElementById('collapse-all');
    const expandAll = document.getElementById('expand-all');
    
    // Update checkboxes state
    collapseAll.checked = false;
    collapseAll.indeterminate = false;
    expandAll.checked = true;
    // Expand all categories
    document.querySelectorAll('.category-items').forEach(items => items.classList.add('active'));
    document.querySelectorAll('.category h2').forEach(h2 => h2.classList.add('active'));
    
    // Update mobile dropdown checkboxes
    document.querySelectorAll('.mobile-category-dropdown .dropdown-option input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = true;
    });
}

// Function to handle collapse all categories
function handleCollapseAllCategories() {
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');
    
    // Update checkboxes state
    expandAll.checked = false;
    expandAll.indeterminate = false;
    collapseAll.checked = true;
    
    // Collapse all categories
    document.querySelectorAll('.category-items').forEach(items => items.classList.remove('active'));
    document.querySelectorAll('.category h2').forEach(h2 => h2.classList.remove('active'));
    
    // Update mobile dropdown checkboxes
    document.querySelectorAll('.mobile-category-dropdown .dropdown-option input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
}

// New function to attach listeners to category headers for toggling
function attachEventListeners() {
  // Attach click listeners on sidebar categories
  document.querySelectorAll('#category-container .category h2').forEach(header => {
      header.addEventListener('click', function() {
          // 'this' refers to the clicked h2 element.
          toggleItems(this);
      });
  });

  // Attach expand/collapse all listeners
  const expandAll = document.getElementById('expand-all');
  const collapseAll = document.getElementById('collapse-all');

  expandAll.addEventListener('click', (e) => {
      if (expandAll.checked) {
          handleExpandAllCategories();
      } else {
          handleCollapseAllCategories();
      }
  });

  collapseAll.addEventListener('click', () => {
      if (collapseAll.checked) {
          handleCollapseAllCategories();
      } else {
          handleExpandAllCategories();
      }
  });

  // Prevent check state change propagation if indeterminate
  [expandAll, collapseAll].forEach(cb => {
      cb.addEventListener('mousedown', (e) => {
          if (cb.indeterminate) {
              e.preventDefault(); // Prevent default change event
          }
      });
  });
}

async function start() {
    // Wait for configuration to load
    await loadConfig();
    // Initialize modal
    initModal();

    // Initialize filters
    initFilters();

    // Initialize category DOM structure and attach event listeners
    await initCategories(); 
    attachEventListeners();
    
    // Expose testing functions to global scope, but only in debug mode
    if (DEBUG_MODE) {
        window.testImageFallbacks = testFallbacks;
        
        // Add helper to simulate a blocked image 
        window.simulateImageError = function(selector = '.item-image') {
            const images = document.querySelectorAll(selector);
            images.forEach(img => {
                // Trigger the error handler manually
                img.dispatchEvent(new Event('error'));
                console.log('Simulated error for:', img);
            });
            return `Simulated errors for ${images.length} images`;
        };

        // Add race condition testing
        window.testRaceCondition = function(itemId, numRequests = 3) {
            return ItemManager.testRaceCondition(itemId, numRequests);
        };

        // Helper to get item IDs for testing
        window.getAvailableItemIds = function() {
            const cachedItems = localStorage.getItem('cachedItems');
            if (cachedItems) {
                const items = JSON.parse(cachedItems);
                const available = items.filter(item => !item.takenBy);
                console.log('Available items for testing:');
                available.forEach(item => {
                    console.log(`- ${item.id} (${item.productZH})`);
                });
                return available.map(item => item.id);
            }
            return [];
        };
    }
    
    // Detect WebP support early
    supportsWebP();
    
    // Then load items and render them into the initialized structure
    await loadItems();
    
    // Initial state check after items are loaded and rendered
    if (DEBUG_MODE) {
        console.log('Initialized and items loaded');
    }
    updateControlCheckboxesState();
}

window.addEventListener('load', start);

// Temporary debug function to unregister service worker
async function unregisterServiceWorkers() {
    let unregistered = false;
    
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('Unregistering service workers for debugging...');
        for (const registration of registrations) {
            await registration.unregister();
            console.log('Service worker unregistered');
            unregistered = true;
        }
        // Clear caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('All caches cleared');
        }
    }
    
    // If we unregistered any service workers, reload the page to ensure they're really gone
    if (unregistered) {
        console.log('Reloading page to ensure service workers are completely removed...');
        window.location.reload(true); // Force reload from server
    }
}

// Direct API tester function - with fallback to no credentials
async function testDirectApiCall() {
    console.log("=== DIRECT API TESTER ===");
    console.log("Performing direct API call to items endpoint without any caching");
    
    try {
        // Create a unique URL to completely avoid caching
        const url = new URL(CONFIG.api.endpoints.items);
        url.searchParams.append('test', Date.now());
        console.log(`Fetching from: ${url.toString()}`);
        
        try {
            // First attempt with minimum headers to avoid CORS issues
            console.log("Attempt #1: Minimal headers");
            const response1 = await fetch(url.toString(), {
                method: 'GET',
                cache: 'no-store'
            });
            
            console.log("Response status:", response1.status, response1.statusText);
            
            if (response1.ok) {
                const data = await response1.json();
                console.log(`Retrieved ${data.length} items`);
                
                // Find the FEED_004 item
                const targetItem = data.find(item => item.sheetProductId === 'FEED_004');
                if (targetItem) {
                    console.log("Target item FEED_004 found:", targetItem);
                    console.log(targetItem);
                } else {
                    console.log("Target item FEED_004 not found in response");
                }
                
                return data;
            } else {
                console.log("First attempt failed, trying with more options...");
            }
        } catch (error) {
            console.error("First attempt failed:", error);
        }
        
        // Second attempt with different options
        console.log("Attempt #2: Different fetch options");
        const response2 = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            cache: 'no-store',
            mode: 'cors',
            credentials: 'omit' // Try without credentials
        });
        
        console.log("Response status:", response2.status, response2.statusText);
        
        if (!response2.ok) {
            throw new Error(`HTTP error: ${response2.status}`);
        }
        
        const data = await response2.json();
        console.log(`Retrieved ${data.length} items`);
        
        // Find the FEED_004 item
        const targetItem = data.find(item => item.sheetProductId === 'FEED_004');
        if (targetItem) {
            console.log("Target item FEED_004 found:", targetItem);
            console.log(targetItem);
        } else {
            console.log("Target item FEED_004 not found in response");
        }
        
        return data;
    } catch (error) {
        console.error("Direct API test failed:", error);
        throw error;
    }
}


if (DEBUG_MODE) {
    // Make the function available but don't call it automatically
    window.unregisterServiceWorkers = unregisterServiceWorkers;
    // Do NOT call testDirectApiCall() automatically
    // Only expose it as a global function to call manually from console
    window.testDirectApiCall = testDirectApiCall;
}
