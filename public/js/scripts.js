import { CONFIG, MESSAGES, DEBUG_MODE } from './constants.js';
import { loadConfig } from './util.js';
import { initModal } from './modal.js';
import { initFilters, filterAndSearchItems, updateControlCheckboxesState } from './filter.js';
import { initCategories } from './category.js';
import { renderItems } from './item.js';
import ItemManager from './itemManager.js';
import { initLazyLoading, testFallbacks } from './imageOptimizer.js';

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
        console.log(`Updated ${updatedItems.size} items:`, Array.from(updatedItems));
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
        
        // Use cache if it's less than 5 minutes old
        if (cachedItems && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 300000) {
            const items = JSON.parse(cachedItems);
            renderItems(items);
            itemsContainer.dataset.loading = 'false';
        }
        
        // Fetch items from Durable Object - now with cache headers
        const itemsPromise = fetch(CONFIG.api.endpoints.items, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        }).then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || MESSAGES.errors.generic);
                });
            }
            return response.json();
        });
        
        // Wait for items to resolve
        const items = await itemsPromise;
        if (DEBUG_MODE) {
            console.log('[Debug] total items: ', items.length);
        }
        
        // Update cache
        localStorage.setItem('cachedItems', JSON.stringify(items));
        localStorage.setItem('cacheTimestamp', now.toString());
        
        // Store initial items state for comparison
        window.lastItemsState = JSON.stringify(items);
        
        // Render items into the structure initialized by initCategories()
        renderItems(items);

        items.forEach(itemData => {
            const itemElement = document.querySelector(`.item[data-item="${itemData.id}"]`);
            if (itemElement) {
                ItemManager.attachClaimListeners(itemElement, itemData.id);
            } else {
                console.warn(`Item element not found for item ID ${itemData.id} after renderItems. Cannot attach claim listeners.`);
            }
        });
        
        // Remove loading state
        itemsContainer.dataset.loading = 'false';
        
        // Set up periodic refresh with exponential backoff
        let retryCount = 0;
        const maxRetryCount = 5;
        const baseInterval = CONFIG.refreshInterval;
        
        const refreshItems = async () => {
            try {
                // Now with proper cache headers
                const updatedItems = await fetch(CONFIG.api.endpoints.items, {
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                }).then(r => r.json());
                
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
        
    } catch (error) {
        // Remove loading state on error
        itemsContainer.dataset.loading = 'false';
        
        console.error('Error loading registry:', error);
        let errorMessage = MESSAGES.errors.generic;
        
        try {
            if (error.message) {
                const errorData = JSON.parse(error.message);
                if (errorData.code === 429) {
                    errorMessage = MESSAGES.errors.rateLimit;
                }
            }
        } catch (parseError) {
            console.error('Error parsing error message:', parseError);
        }
        
        // Check if itemsContainer exists before using it
        if (itemsContainer) {
            itemsContainer.innerHTML = `
                <div class="error-message">
                    <p>${errorMessage.en}</p>
                    <p>${errorMessage.zh}</p>
                </div>
            `;
        }
    }
}

// Function to handle expand all categories
function handleExpandAllCategories() {
    const collapseAll = document.getElementById('collapse-all');
    
    // Update checkboxes state
    collapseAll.checked = false;
    collapseAll.indeterminate = false;
    
    // Expand all categories
    document.querySelectorAll('.category-items').forEach(items => items.classList.add('active'));
    document.querySelectorAll('.category h2').forEach(h2 => h2.classList.add('active'));
}

// Function to handle collapse all categories
function handleCollapseAllCategories() {
    const expandAll = document.getElementById('expand-all');
    
    // Update checkboxes state
    expandAll.checked = false;
    expandAll.indeterminate = false;
    
    // Collapse all categories
    document.querySelectorAll('.category-items').forEach(items => items.classList.remove('active'));
    document.querySelectorAll('.category h2').forEach(h2 => h2.classList.remove('active'));
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
      }
  });

  collapseAll.addEventListener('click', () => {
      if (collapseAll.checked) {
          handleCollapseAllCategories();
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
    initCategories(); 
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
    }
    
    // Then load items and render them into the initialized structure
    loadItems().then(() => {
        // Initialize lazy loading for images
        initLazyLoading();
        
        // Initial state check after items are loaded and rendered
        console.log('initial state update after items loaded');
        updateControlCheckboxesState();
    });
}

window.addEventListener('load', start);
