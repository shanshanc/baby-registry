//# allFunctionsCalledOnLoad

import { CONFIG, MESSAGES, DEBUG_MODE } from './constants.js';
import { loadConfig } from './util.js';
import { initModal } from './modal.js';
import { initFilters, filterAndSearchItems, updateControlCheckboxesState, updateFilterState, updateSearchState } from './filter.js';
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
    
    // Update mobile dropdown checkboxes in sticky header
    const mobileSelectAll = document.getElementById('mobile-select-all');
    const mobileCategoryCheckboxes = document.querySelectorAll('#mobile-dropdown-options input[data-category]');
    
    if (mobileSelectAll) {
        mobileSelectAll.checked = true;
        mobileSelectAll.indeterminate = false;
    }
    
    mobileCategoryCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Update mobile dropdown display text
    const mobileDropdownText = document.querySelector('.mobile-dropdown-text');
    if (mobileDropdownText) {
        mobileDropdownText.textContent = '所有分類';
    }
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
    
    // Update mobile dropdown checkboxes in sticky header
    const mobileSelectAll = document.getElementById('mobile-select-all');
    const mobileCategoryCheckboxes = document.querySelectorAll('#mobile-dropdown-options input[data-category]');
    
    if (mobileSelectAll) {
        mobileSelectAll.checked = false;
        mobileSelectAll.indeterminate = false;
    }
    
    mobileCategoryCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Update mobile dropdown display text
    const mobileDropdownText = document.querySelector('.mobile-dropdown-text');
    if (mobileDropdownText) {
        mobileDropdownText.textContent = '無選擇';
    }
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

// Initialize expand/collapse controls to reflect default state (all categories active)
function initializeExpandCollapseControls() {
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');
    
    if (expandAll && collapseAll) {
        // Since all categories are active by default, expand all should be checked
        expandAll.checked = true;
        expandAll.indeterminate = false;
        collapseAll.checked = false;
        collapseAll.indeterminate = false;
    }
}

// Call during initialization
async function init() {
    // Wait for configuration to load
    await loadConfig();
    // Initialize modal
    initModal();

    // Initialize filters
    initFilters();

    // Initialize category DOM structure and attach event listeners
    await initCategories();
    attachEventListeners();
    
    // Initialize expand/collapse controls to match default state
    initializeExpandCollapseControls();
    
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
        console.log('Category headers active:', document.querySelectorAll('.category h2.active').length);
        console.log('Category items active:', document.querySelectorAll('.category-items.active').length);
    }
    updateControlCheckboxesState();
    
    // Initialize sticky header with a slight delay to ensure DOM is fully ready
    setTimeout(() => {
        initStickyHeader();
    }, 150);
}

window.addEventListener('load', init);

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

// Sticky Header Functionality
function initStickyHeader() {
    const stickyHeader = document.getElementById('sticky-header');
    const container = document.querySelector('.container');
    const heroSection = container.querySelector('.title').parentElement; // Get hero section
    
    let heroHeight = 0;
    let isVisible = false;
    let isMobileInteracting = false; // Flag to track mobile interaction state

    // Set mobile interaction state
    function setMobileInteracting(state) {
        isMobileInteracting = state;
        // Immediately check if header visibility needs to update
        setTimeout(handleScroll, 10);
    }

    // Check if we need to force sticky header visibility on mobile
    function shouldForceHeaderVisibility() {
        // Only apply this logic on mobile
        if (window.innerWidth > 768) return false;
        
        // If user is actively interacting with mobile sticky header, keep it visible
        if (isMobileInteracting) return true;
        
        // Check if all categories are collapsed
        const visibleCategoryItems = document.querySelectorAll('.category-items.active');
        const allCategoriesCollapsed = visibleCategoryItems.length === 0;
        
        // Check if no items are visible due to filtering
        const visibleItems = document.querySelectorAll('.item:not([style*="display: none"])');
        const noItemsVisible = visibleItems.length === 0;
        
        return allCategoriesCollapsed || noItemsVisible;
    }

    // Handle scroll events
    function handleScroll() {
        const scrollY = window.scrollY;
        const shouldShow = scrollY > heroHeight || shouldForceHeaderVisibility();
        
        if (shouldShow !== isVisible) {
            isVisible = shouldShow;
            stickyHeader.classList.toggle('visible', shouldShow);
            
            // Adjust sidebar position on desktop when sticky header is visible
            document.body.classList.toggle('sticky-header-active', shouldShow);
        }
    }

    // Handle navigation clicks
    function handleNavClick(event) {
        const target = event.currentTarget.dataset.target;
        
        // On mobile, just scroll to top since the important info is in the hero section
        // and the sticky header will hide anyway
        if (window.innerWidth <= 768) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            // Desktop: scroll to the specific element
            const targetElement = document.getElementById(target);
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 20; // Account for sticky header
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        }
    }

    // Populate mobile category dropdown
    function populateMobileCategorySelect() {
        const mobileDropdownOptions = document.getElementById('mobile-dropdown-options');
        const categoryHeaders = document.querySelectorAll('#category-container .category h2');
        
        if (mobileDropdownOptions && categoryHeaders.length > 0) {
            // Keep the "Select All" option, remove any existing category options
            const selectAllOption = mobileDropdownOptions.querySelector('.mobile-dropdown-option');
            mobileDropdownOptions.innerHTML = '';
            mobileDropdownOptions.appendChild(selectAllOption);
            
            // Add category options
            categoryHeaders.forEach(header => {
                const categoryName = header.textContent.trim();
                const categoryValue = header.dataset.category;
                if (categoryValue) {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'mobile-dropdown-option';
                    optionDiv.innerHTML = `
                        <label>
                            <input type="checkbox" data-category="${categoryValue}" checked>
                            <span>${categoryName}</span>
                        </label>
                    `;
                    mobileDropdownOptions.appendChild(optionDiv);
                }
            });
        }
    }

    // Handle mobile category dropdown
    function initMobileCategoryDropdown() {
        const dropdown = document.getElementById('mobile-category-dropdown');
        const header = document.getElementById('mobile-dropdown-header');
        const options = document.getElementById('mobile-dropdown-options');
        const selectAllCheckbox = document.getElementById('mobile-select-all');
        const dropdownText = header.querySelector('.mobile-dropdown-text');

        // Toggle dropdown visibility
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        // Handle select all functionality
        selectAllCheckbox.addEventListener('change', () => {
            const categoryCheckboxes = options.querySelectorAll('input[data-category]');
            const isSelectAllChecked = selectAllCheckbox.checked;
            
            categoryCheckboxes.forEach(checkbox => {
                checkbox.checked = isSelectAllChecked;
            });
            
            updateMobileCategoryDisplay();
            applyMobileCategorySelection();
        });

        // Handle individual category checkbox changes
        options.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.dataset.category) {
                updateMobileCategoryDisplay();
                applyMobileCategorySelection();
                
                // Update select all state
                const categoryCheckboxes = options.querySelectorAll('input[data-category]');
                const checkedCount = options.querySelectorAll('input[data-category]:checked').length;
                
                if (checkedCount === categoryCheckboxes.length) {
                    selectAllCheckbox.checked = true;
                    selectAllCheckbox.indeterminate = false;
                } else if (checkedCount === 0) {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = false;
                } else {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = true;
                }
            }
        });

        // Update dropdown text based on selections
        function updateMobileCategoryDisplay() {
            const categoryCheckboxes = options.querySelectorAll('input[data-category]');
            const checkedCategories = options.querySelectorAll('input[data-category]:checked');
            
            if (checkedCategories.length === 0) {
                dropdownText.textContent = '無選擇';
            } else if (checkedCategories.length === categoryCheckboxes.length) {
                dropdownText.textContent = '所有分類';
            } else if (checkedCategories.length === 1) {
                const categoryName = checkedCategories[0].nextElementSibling.textContent;
                dropdownText.textContent = categoryName;
            } else {
                dropdownText.textContent = `已選 ${checkedCategories.length} 個分類`;
            }
        }

        // Apply category selection to show/hide categories
        function applyMobileCategorySelection() {
            const checkedCategories = options.querySelectorAll('input[data-category]:checked');
            const selectedValues = Array.from(checkedCategories).map(cb => cb.dataset.category);
            
            // Hide all categories first
            document.querySelectorAll('.category-items').forEach(items => {
                items.classList.remove('active');
            });
            document.querySelectorAll('.category h2').forEach(h2 => {
                h2.classList.remove('active');
            });
            
            // Show selected categories
            selectedValues.forEach(categoryValue => {
                const categoryItems = document.querySelector(`.category-items[data-category="${categoryValue}"]`);
                const categoryHeader = document.querySelector(`.category h2[data-category="${categoryValue}"]`);
                
                if (categoryItems) {
                    categoryItems.classList.add('active');
                }
                if (categoryHeader) {
                    categoryHeader.classList.add('active');
                }
            });
            
            // Update control checkboxes state
            updateControlCheckboxesState();
            
            // Check if sticky header visibility needs to be updated
            setTimeout(handleScroll, 100);
        }

        // Initialize dropdown with all categories checked
        function initializeMobileDropdown() {
            const selectAllCheckbox = document.getElementById('mobile-select-all');
            const categoryCheckboxes = options.querySelectorAll('input[data-category]');
            
            // Debug: Check if categories are loaded
            if (DEBUG_MODE) {
                console.log('Initializing mobile dropdown...');
                console.log('Category checkboxes found:', categoryCheckboxes.length);
                console.log('Category headers in DOM:', document.querySelectorAll('#category-container .category h2').length);
                console.log('Category items in DOM:', document.querySelectorAll('.category-items').length);
            }
            
            // Set all categories as checked by default
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
            
            categoryCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
                if (DEBUG_MODE) {
                    console.log('Setting checkbox checked for category:', checkbox.dataset.category);
                }
            });
            
            // Update display text
            updateMobileCategoryDisplay();
            
            // Ensure all categories are visible (this should match the default state)
            const categoryItems = document.querySelectorAll('.category-items');
            const categoryHeaders = document.querySelectorAll('.category h2');
            
            categoryItems.forEach(items => {
                items.classList.add('active');
                if (DEBUG_MODE) {
                    console.log('Setting category items active:', items.dataset.category);
                }
            });
            
            categoryHeaders.forEach(h2 => {
                h2.classList.add('active');
                if (DEBUG_MODE) {
                    console.log('Setting category header active:', h2.dataset.category);
                }
            });
            
            // Update control checkboxes state
            updateControlCheckboxesState();
            
            if (DEBUG_MODE) {
                console.log('Mobile dropdown initialization complete');
                console.log('Active category items:', document.querySelectorAll('.category-items.active').length);
                console.log('Active category headers:', document.querySelectorAll('.category h2.active').length);
            }
        }

        // Initial setup - use timeout to ensure DOM is ready
        setTimeout(() => {
            initializeMobileDropdown();
        }, 100);
    }

    // Sync mobile filters with sidebar filters
    function syncMobileFilters() {
        const sidebarStatusFilter = document.querySelector('input[name="status-filter"]:checked');
        const mobileStatusFilter = document.getElementById('mobile-status-filter');
        const sidebarSearchInput = document.getElementById('search-input');
        const mobileSearchInput = document.getElementById('mobile-search-input');
        const sidebarClearBtn = document.getElementById('search-clear-btn');
        const mobileClearBtn = document.getElementById('mobile-search-clear-btn');

        if (sidebarStatusFilter && mobileStatusFilter) {
            mobileStatusFilter.value = sidebarStatusFilter.value;
        }

        if (sidebarSearchInput && mobileSearchInput) {
            mobileSearchInput.value = sidebarSearchInput.value;
        }

        // Sync mobile filter changes back to sidebar
        if (mobileStatusFilter) {
            mobileStatusFilter.addEventListener('change', () => {
                const sidebarRadio = document.querySelector(`input[name="status-filter"][value="${mobileStatusFilter.value}"]`);
                if (sidebarRadio) {
                    sidebarRadio.checked = true;
                }
                // Update filter state and trigger filter change
                updateFilterState(mobileStatusFilter.value);
                filterAndSearchItems();
            });
        }

        // Sync mobile search changes back to sidebar
        if (mobileSearchInput && sidebarSearchInput) {
            mobileSearchInput.addEventListener('input', () => {
                sidebarSearchInput.value = mobileSearchInput.value;
                
                // Update search state and trigger filter change
                updateSearchState(mobileSearchInput.value);
                filterAndSearchItems();
                
                // Show/hide clear buttons
                const hasValue = mobileSearchInput.value.length > 0;
                mobileClearBtn.classList.toggle('visible', hasValue);
                sidebarClearBtn.classList.toggle('visible', hasValue);
            });
        }

        // Handle mobile clear button
        if (mobileClearBtn) {
            mobileClearBtn.addEventListener('click', () => {
                mobileSearchInput.value = '';
                sidebarSearchInput.value = '';
                mobileClearBtn.classList.remove('visible');
                sidebarClearBtn.classList.remove('visible');
                
                // Clear search state and trigger filter change
                updateSearchState('');
                filterAndSearchItems();
            });
        }
    }

    // Update tooltip content with actual data
    function updateTooltipContent() {
        const bankAccountElement = document.getElementById('bank-account');
        const shippingAddressElement = document.getElementById('shipping-address');
        const recipientElement = document.getElementById('recipient');
        
        const bankNavItem = document.querySelector('.sticky-nav-item[data-target="bank-account"]');
        const shippingNavItem = document.querySelector('.sticky-nav-item[data-target="shipping-address"]');
        
        if (bankNavItem && bankAccountElement && bankAccountElement.textContent !== '載入中...') {
            const bankInfo = bankAccountElement.textContent.trim();
            bankNavItem.setAttribute('data-tooltip', bankInfo);
        }
        
        if (shippingNavItem && shippingAddressElement && recipientElement && 
            shippingAddressElement.textContent !== '載入中...' && recipientElement.textContent !== '載入中...') {
            const address = shippingAddressElement.textContent.trim();
            const recipient = recipientElement.textContent.trim();
            const shippingInfo = `${address} | ${recipient}`;
            shippingNavItem.setAttribute('data-tooltip', shippingInfo);
        }
    }

    // Calculate hero section height
    function calculateHeroHeight() {
        const title = container.querySelector('.title');
        const bankAccount = container.querySelector('.bank-account');
        const address = container.querySelector('.address');
        const recipient = container.querySelector('.recipient');
        
        if (title) {
            const titleRect = title.getBoundingClientRect();
            
            // Mobile: Trigger early (after title passes) since filters are in sticky header
            if (window.innerWidth <= 768) {
                heroHeight = titleRect.bottom - titleRect.top; // Title height + padding
            } 
            // Desktop: Trigger after full hero section since sidebar is always available
            else if (bankAccount && address && recipient) {
                const recipientRect = recipient.getBoundingClientRect();
                heroHeight = recipientRect.bottom - titleRect.top + 50; // Full hero section + padding
            }
        }
    }

    // Add mobile interaction tracking
    function initMobileInteractionTracking() {
        // Mobile search interaction tracking
        const mobileSearchInput = document.getElementById('mobile-search-input');
        if (mobileSearchInput) {
            mobileSearchInput.addEventListener('focus', () => setMobileInteracting(true));
            mobileSearchInput.addEventListener('blur', () => {
                // Keep interacting flag if search has content
                if (mobileSearchInput.value.trim().length === 0) {
                    setMobileInteracting(false);
                }
            });
            mobileSearchInput.addEventListener('input', () => {
                // Set interacting flag if search has content
                setMobileInteracting(mobileSearchInput.value.trim().length > 0);
            });
        }

        // Mobile dropdown interaction tracking
        const mobileDropdown = document.getElementById('mobile-category-dropdown');
        const mobileDropdownHeader = document.getElementById('mobile-dropdown-header');
        if (mobileDropdown && mobileDropdownHeader) {
            // Track dropdown open/close
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const isOpen = mobileDropdown.classList.contains('open');
                        setMobileInteracting(isOpen);
                    }
                });
            });
            observer.observe(mobileDropdown, { attributes: true });
        }

        // Mobile filter interaction tracking
        const mobileStatusFilter = document.getElementById('mobile-status-filter');
        if (mobileStatusFilter) {
            mobileStatusFilter.addEventListener('focus', () => setMobileInteracting(true));
            mobileStatusFilter.addEventListener('blur', () => setMobileInteracting(false));
        }

        // Mobile clear button interaction
        const mobileClearBtn = document.getElementById('mobile-search-clear-btn');
        if (mobileClearBtn) {
            mobileClearBtn.addEventListener('click', () => {
                // Clear interaction flag when clearing search
                setMobileInteracting(false);
            });
        }
    }

    // Initialize
    calculateHeroHeight();
    
    // Populate mobile category dropdown after categories are loaded
    populateMobileCategorySelect();
    
    // Initialize mobile category dropdown functionality
    initMobileCategoryDropdown();
    
    syncMobileFilters();
    
    // Update tooltips with actual data (initial and periodic check)
    updateTooltipContent();
    
    // Register callback for filter system to notify sticky header
    window.stickyHeaderCheckCallback = handleScroll;
    
    // Check for data updates periodically
    const tooltipUpdateInterval = setInterval(() => {
        updateTooltipContent();
        
        // Stop checking once both are loaded
        const bankLoaded = document.getElementById('bank-account')?.textContent !== '載入中...';
        const addressLoaded = document.getElementById('shipping-address')?.textContent !== '載入中...';
        const recipientLoaded = document.getElementById('recipient')?.textContent !== '載入中...';
        
        if (bankLoaded && addressLoaded && recipientLoaded) {
            clearInterval(tooltipUpdateInterval);
        }
    }, 500);

    // Add event listeners
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', () => {
        calculateHeroHeight();
        // Recheck sticky header visibility on resize
        setTimeout(handleScroll, 100);
    });

    // Attach navigation handlers
    const navItems = document.querySelectorAll('.sticky-nav-item, .sticky-nav-item-mobile');
    navItems.forEach(item => {
        item.addEventListener('click', handleNavClick);
    });

    // Sync filters when sidebar filters change
    const sidebarRadios = document.querySelectorAll('input[name="status-filter"]');
    sidebarRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const mobileSelect = document.getElementById('mobile-status-filter');
            if (mobileSelect) {
                mobileSelect.value = radio.value;
            }
        });
    });

    // Sync search input when sidebar search changes
    const sidebarSearch = document.getElementById('search-input');
    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', () => {
            const mobileSearch = document.getElementById('mobile-search-input');
            if (mobileSearch) {
                mobileSearch.value = sidebarSearch.value;
            }
        });
    }

    // Initialize mobile interaction tracking
    initMobileInteractionTracking();
}

if (DEBUG_MODE) {
    // Make the function available but don't call it automatically
    window.unregisterServiceWorkers = unregisterServiceWorkers;
    // Do NOT call testDirectApiCall() automatically
    // Only expose it as a global function to call manually from console
    window.testDirectApiCall = testDirectApiCall;
}
