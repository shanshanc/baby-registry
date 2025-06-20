// Add filter and search state
let currentFilter = 'all';
let currentSearch = '';
let searchDebounceTimer = null;
const DEBOUNCE_DELAY = 300; // 300ms delay

import { sanitizeInput } from './util.js';

// Debounce function to limit how often a function is called
function debounce(func, delay) {
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            func.apply(context, args);
        }, delay);
    };
}

// Function to update the expand/collapse all checkbox states based on current category states
function updateControlCheckboxesState() {
    const categoryItems = document.querySelectorAll('.category-items');
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');
    const totalCategories = categoryItems.length;

    let activeCount = document.querySelectorAll('.category h2.active').length;
    
    if (activeCount === totalCategories) {
        // All expanded
        expandAll.checked = true;
        expandAll.indeterminate = false;
        collapseAll.checked = false;
        collapseAll.indeterminate = false;
    } else if (activeCount === 0) {
        // All collapsed
        expandAll.checked = false;
        expandAll.indeterminate = false;
        collapseAll.checked = true;
        collapseAll.indeterminate = false;
    } else {
        // Partially expanded/collapsed
        expandAll.checked = false;
        expandAll.indeterminate = true;
        collapseAll.checked = false;
        collapseAll.indeterminate = true;
    }
}

function filterAndSearchItems() {
    const items = document.querySelectorAll('.item');
    const categories = document.querySelectorAll('.category-items');
    
    // Track items visibility by subcategory
    const subcategoryVisibility = {};
    
    // First pass: determine visibility of each item and track which subcategories have visible items
    items.forEach(item => {
        const status = item.querySelector('.product-status');
        const productData = item.querySelector('.item-content')?.dataset.product || '';
        
        const matchesFilter = currentFilter === 'all' || 
            (currentFilter === 'available' && status?.classList.contains('available')) ||
            (currentFilter === 'taken' && status?.classList.contains('taken'));
            
        // Make sure sanitized search term matches sanitized product data
        const sanitizedSearch = currentSearch.toLowerCase();
        const sanitizedProductData = productData.toLowerCase();
        const matchesSearch = !sanitizedSearch || 
            sanitizedProductData.includes(sanitizedSearch);
            
        const isVisible = matchesFilter && matchesSearch;
        item.style.display = isVisible ? '' : 'none';
        
        // Track which item container this belongs to for subcategory visibility
        const itemsListContainer = item.closest('.items-list');
        if (itemsListContainer) {
            const categoryName = itemsListContainer.dataset.categoryName;
            const subcategoryName = itemsListContainer.dataset.subcategoryName;
            
            if (!subcategoryVisibility[categoryName]) {
                subcategoryVisibility[categoryName] = {};
            }
            
            if (!subcategoryVisibility[categoryName][subcategoryName]) {
                subcategoryVisibility[categoryName][subcategoryName] = { 
                    visibleItems: 0, 
                    container: itemsListContainer 
                };
            }
            
            if (isVisible) {
                subcategoryVisibility[categoryName][subcategoryName].visibleItems++;
            }
        }
    });
    
    // Second pass: handle subcategory visibility
    Object.entries(subcategoryVisibility).forEach(([categoryName, subcategories]) => {
        Object.entries(subcategories).forEach(([subcategoryName, data]) => {
            const { visibleItems, container } = data;
            const subcategoryHeader = container.previousElementSibling;
            
            // Check if this is a default container for a category with no predefined subcategories
            const isDefaultSubcategory = subcategoryName === 'default';
            
            if (visibleItems === 0) {
                // Hide subcategory if it's not a default container
                if (subcategoryHeader && subcategoryHeader.classList.contains('subcategory')) {
                    subcategoryHeader.style.display = 'none';
                }
                
                // Hide the container itself if not a default container
                if (!isDefaultSubcategory) {
                    container.style.display = 'none';
                } else {
                    // Use default display value (to show container) even though it's empty (after filtering/searching)
                    container.style.display = '';
                }
            } else {
                // Show subcategory header and container if there are visible items
                if (subcategoryHeader && subcategoryHeader.classList.contains('subcategory')) {
                    subcategoryHeader.style.display = '';
                }
                container.style.display = '';
            }
        });
    });
    
    // Keep categories visible but update their content visibility
    categories.forEach(category => {
        const categoryHeader = document.querySelector(`.category h2[data-category="${category.dataset.category}"]`);
        
        // Always keep category header visible
        if (categoryHeader) {
            categoryHeader.style.display = '';
        }
        
        // If category is active (expanded), show it regardless of content
        if (category.classList.contains('active')) {
            category.style.display = '';
        }
    });
    
    // Update expand/collapse state
    updateControlCheckboxesState();
    
    // Notify that filtering is complete (for sticky header logic)
    if (window.stickyHeaderCheckCallback) {
        setTimeout(window.stickyHeaderCheckCallback, 100);
    }
}

function attachFilterListeners() {
    const filterInputs = document.querySelectorAll('input[name="status-filter"]');
    filterInputs.forEach(input => {
        input.addEventListener('change', debounce((e) => {
            currentFilter = e.target.value;
            filterAndSearchItems();
        }, DEBOUNCE_DELAY));
    });
}

function attachSearchListener() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    
    if (searchInput) {
        // Input event listener with debouncing
        searchInput.addEventListener('input', debounce((e) => {
            // Sanitize the search input
            currentSearch = sanitizeInput(e.target.value.trim());
            filterAndSearchItems();
            
            // Show/hide clear button based on search content
            if (currentSearch.length > 0) {
                clearBtn.classList.add('visible');
            } else {
                clearBtn.classList.remove('visible');
            }
        }, DEBOUNCE_DELAY));
        
        // Clear button click handler
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                currentSearch = '';
                filterAndSearchItems();
                clearBtn.classList.remove('visible');
                searchInput.focus(); // Return focus to the search input
            });
        }
    }
}

function initFilters() {
    // Attach listeners
    attachFilterListeners();
    attachSearchListener();
}

// Functions to update filter state from external sources (e.g., mobile controls)
function updateFilterState(filterValue) {
    currentFilter = filterValue;
}

function updateSearchState(searchValue) {
    currentSearch = sanitizeInput(searchValue.trim());
}

export { initFilters, filterAndSearchItems, updateControlCheckboxesState, updateFilterState, updateSearchState };
