import { Category, Subcategory, CATEGORY_TO_SUBCATEGORIES, CategoryZH, SubcategoryZH } from './types.js';
import { initModal, showClaimSuccessModal } from './modal.js';

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

async function claimItem(itemId, claimer) {
    try {
        const response = await fetch(`${CONFIG.api.endpoints.items}/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id: itemId,
                takenBy: claimer
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to claim item');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error claiming item:', error);
        alert('Failed to claim item. Please try again.');
        throw error;
    }
}

// Add filter and search state
let currentFilter = 'all';
let currentSearch = '';

function filterAndSearchItems() {
    const items = document.querySelectorAll('.item');
    const categories = document.querySelectorAll('.category-items');
    
    items.forEach(item => {
        const status = item.querySelector('.product-status');
        const productName = item.querySelector('.product-name')?.textContent || '';
        const productNameZH = item.querySelector('.product-name')?.textContent || '';
        
        const matchesFilter = currentFilter === 'all' || 
            (currentFilter === 'available' && status?.classList.contains('available')) ||
            (currentFilter === 'taken' && status?.classList.contains('taken'));
            
        const matchesSearch = !currentSearch || 
            productName.toLowerCase().includes(currentSearch.toLowerCase()) ||
            productNameZH.toLowerCase().includes(currentSearch.toLowerCase());
            
        const isVisible = matchesFilter && matchesSearch;
        item.style.display = isVisible ? '' : 'none';
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
}

function attachFilterListeners() {
    const filterInputs = document.querySelectorAll('input[name="status-filter"]');
    filterInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            filterAndSearchItems();
        });
    });
}

function attachSearchListener() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.trim();
            filterAndSearchItems();
        });
    }
}

async function loadItems() {
    const categoryContainer = document.getElementById('category-container');
    const itemsContainer = document.getElementById('items-container');
    
    // Add filter and search controls to the sidebar after expand/collapse controls
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const controls = document.createElement('div');
        controls.className = 'filter-search-controls';
        controls.innerHTML = `
            <div class="filter-controls">
                <div class="filter-controls-label">篩選認領狀態</div>
                <div class="filter-controls-radio">
                  <label>
                    <input type="radio" name="status-filter" value="all" checked> All
                  </label>
                  <label>
                      <input type="radio" name="status-filter" value="available"> Available
                  </label>
                  <label>
                      <input type="radio" name="status-filter" value="taken"> Taken
                  </label>
                </div>
            </div>
            <div class="search-control">
                <div class="search-control-label">搜尋產品</div>
                <input type="text" id="search-input" placeholder="Search items...">
            </div>
        `;
        // Find the controls div and insert after it
        const existingControls = sidebar.querySelector('.controls');
        if (existingControls) {
            existingControls.insertAdjacentElement('afterend', controls);
        } else {
            sidebar.insertBefore(controls, sidebar.firstChild);
        }
    }
    
    try {
        // Fetch items from Durable Object
        const itemsPromise = fetch(CONFIG.api.endpoints.items)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(errorData.message || MESSAGES.errors.generic.en);
                    });
                }
                return response.json();
            });
        
        // Wait for items to resolve
        const items = await itemsPromise;
        
        // Store initial items state for comparison
        window.lastItemsState = JSON.stringify(items);
        
        categoryContainer.innerHTML = '';
        itemsContainer.innerHTML = '';
        
        // Initialize categories object from Category enum
        const categories = {};
        for (const catKey in Category) {
            categories[Category[catKey]] = {}; // Initialize with empty subcategories
        }

        // Group items by category and subcategory
        items.forEach(item => {
            if (categories[item.category]) { // Ensure category exists
                if (!categories[item.category][item.subcategory]) {
                    categories[item.category][item.subcategory] = [];
                }
                categories[item.category][item.subcategory].push(item);
            } else {
                console.warn(`Item with unknown category: ${item.category}`, item);
            }
        });

        let categoryContent = '';
        let subcategoryContent = '';
        let firstCategory = true; // To make the first category active

        // Iterate over Category enum to maintain order and include all categories
        Object.values(Category).forEach(categoryName => {
            const subcategories = categories[categoryName];
            
            // Prepare categories
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            categoryDiv.innerHTML = `<h2 class="cat-${categoryName.toLocaleLowerCase()} ${firstCategory ? 'active' : ''}" data-category="${categoryName}">${CategoryZH[categoryName]}</h2>`;
            categoryContent += categoryDiv.outerHTML;
            
            // Prepare subcategories and items container
            const subcategoryItemsContainerDiv = document.createElement('div');
            subcategoryItemsContainerDiv.className = 'category-items';
            if (firstCategory) {
                subcategoryItemsContainerDiv.classList.add('active');
            }
            subcategoryItemsContainerDiv.setAttribute('data-category', categoryName);
            
            let currentSubcategoryHTML = '';
            if (subcategories && Object.keys(subcategories).length > 0) {
                Object.entries(subcategories).forEach(([subcategoryName, subcategoryItems]) => {
                    // Add subcategory header only once
                    currentSubcategoryHTML += `<div class="subcategory sub-${subcategoryName.toLowerCase().replace(/[^a-z0-9]/g, '-')}">${SubcategoryZH[subcategoryName] ? SubcategoryZH[subcategoryName] : subcategoryName}</div>`;
                    // Add all items under this subcategory
                    let itemsHTML = '';
                    subcategoryItems.forEach(item => {
                        itemsHTML += createItemHTML(item);
                    });
                    currentSubcategoryHTML += itemsHTML;
                });
            } else {
                // Handle empty categories (display a message or leave empty)
                currentSubcategoryHTML = '<p class="empty-category-message">No items in this category yet.</p>';
            }
            subcategoryItemsContainerDiv.innerHTML = currentSubcategoryHTML;
            subcategoryContent += subcategoryItemsContainerDiv.outerHTML;

            if (firstCategory) {
                firstCategory = false;
            }
        });

        // Append category content to container
        categoryContainer.innerHTML = categoryContent;
        itemsContainer.innerHTML = subcategoryContent;

        // Attach event listeners to category headers
        document.querySelectorAll('.category h2').forEach(header => {
            header.addEventListener('click', function() {
                toggleItems(this);
            });
        });

        // Add new event listeners for enabling/disabling save button and handling save click
        document.querySelectorAll('.item').forEach(itemDiv => {
            const saveButton = itemDiv.querySelector('.save-button');
            // Only add listeners if a save button exists (i.e., item is not claimed)
            if (saveButton) {
                const nameInput = itemDiv.querySelector('.taken-by');
                const itemId = itemDiv.dataset.item;

                const updateSaveButtonState = () => {
                    const nameValue = nameInput.value.trim();
                    // Disable button if name is empty
                    saveButton.disabled = !nameValue;
                };

                // Add input listeners to check field values
                nameInput.addEventListener('input', updateSaveButtonState);

                // Add click listener to the save button
                saveButton.addEventListener('click', async () => {
                    const claimer = nameInput.value.trim();

                    // Double-check values before claiming
                    if (claimer) {
                        try {
                            // Optional: Add visual feedback (e.g., disable fields, show spinner)
                            saveButton.textContent = 'Saving...';
                            saveButton.disabled = true;
                            nameInput.disabled = true;

                            await claimItem(itemId, claimer);
                            
                            // Hide the claim toggle message
                            const claimToggle = itemDiv.querySelector('.claim-toggle');
                            if (claimToggle) {
                                claimToggle.style.display = 'none';
                            }
                            
                            // Keep inputs disabled
                            saveButton.disabled = true;
                            nameInput.disabled = true;
                            saveButton.textContent = '已認領';
                        } catch (error) {
                            // Re-enable fields if claim fails
                            saveButton.textContent = '認領';
                            saveButton.disabled = false;
                            nameInput.disabled = false;
                            updateSaveButtonState();
                        }
                    }
                });

                attachClaimListeners(itemDiv, itemId);
                // Initial check
                updateSaveButtonState();
            }
        });
        
        // Set up periodic refresh
        setInterval(async () => {
            try {
                const updatedItems = await fetch(CONFIG.api.endpoints.items).then(r => r.json());
                updateUIWithItems(updatedItems);
            } catch (error) {
                console.error('Error refreshing items:', error);
            }
        }, CONFIG.refreshInterval);
        
        // Attach filter and search listeners after items are loaded
        attachFilterListeners();
        attachSearchListener();
        
    } catch (error) {
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
        
        itemsContainer.innerHTML = `
            <div class="error-message">
                <p>${errorMessage.en}</p>
                <p>${errorMessage.zh}</p>
            </div>
        `;
    }
}

function createItemHTML(item) {
    const productName = item.product.toLowerCase().replace(/ /g, '-');
    // Special handling for Donate category items
    if (item.category === 'Donate') {
        return `
            <div class="item" data-item="${item.id}">
                <div class="item-content donate-info">
                    <div class="donate-message">若沒有適合的禮物，也很歡迎捐贈現金，我們會用來購買其他寶寶用品。</div>
                    ${item.imageUrl ? `<img src="${item.imageUrl}" alt="Donate QR Code" class="donate-image">` : ''}
                </div>
            </div>
        `;
    }
    
    // Regular item handling
    const statusSpan = item.takenBy ? `<span class="product-status taken">Taken</span>` : `<span class="product-status available">Available</span>`;
    const claimFields = item.takenBy ?
    `<div class="claim-actions">
        <div class="claim-fields visible">
            <input type="text" class="claimer-name" value="${item.takenBy}" readonly="true">
            <span class="claim-toggle" disabled="true">已認領</span>
        </div>
    </div>`: `<div class="claim-actions">
        <div class="claim-fields visible">
            <input type="text" class="taken-by" placeholder="您的大名 💕">
            <button class="save-button" disabled>認領</button>
        </div>
    </div>`;
    
    return `
        <div class="item" data-item="${item.id}">
            <div class="item-content">
                ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${productName}" class="item-image">` : ''}
                <div class="item-details">
                    <div class="product-header">
                        ${item.url ? `<a href="${item.url}" class="product-name" target="_blank" rel="">${item.productZH}</a>` : ''}
                        ${statusSpan}
                    </div>
                    ${item.url ? `<div class="product-url"><span>查看產品: </span><a href="${item.url}" class="product-url" target="_blank" rel="">連結</a></div>` : ''}
                    ${item.price ? `<div class="product-price">$${item.price}</div>` : ''}
                    ${claimFields}
                </div>
            </div>
        </div>
    `;
}

// Update UI with new items data
function updateUIWithItems(items) {
    // Compare with last state to avoid unnecessary updates
    const currentState = JSON.stringify(items);
    if (currentState === window.lastItemsState) {
        return; // No changes, skip update
    }
    window.lastItemsState = currentState;

    // Track which items were updated to avoid duplicate processing
    const updatedItems = new Set();
    
    items.forEach(item => {
        const itemElement = document.querySelector(`[data-item="${item.id}"]`);
        if (itemElement) {
            const claimToggle = itemElement.querySelector('.claim-toggle');
            const statusSpan = itemElement.querySelector('.product-status');
            const nameInput = itemElement.querySelector('.claimer-name');
            
            // Only update if the takenBy status has changed
            const currentTakenBy = nameInput ? nameInput.value : '';
            if (item.takenBy !== currentTakenBy) {
                updatedItems.add(item.id);
                
                // Update status
                if (statusSpan) {
                    statusSpan.textContent = item.takenBy ? 'Taken' : 'Available';
                    statusSpan.classList.toggle('taken', !!item.takenBy);
                    statusSpan.classList.toggle('available', !item.takenBy);
                }
                
                if (claimToggle) {
                    claimToggle.textContent = item.takenBy ? '已認領' : 'Available';
                    claimToggle.setAttribute('disabled', !!item.takenBy);
                }
                
                // Update or create claim fields
                const claimActions = itemElement.querySelector('.claim-actions');
                if (claimActions) {
                    if (item.takenBy) {
                        claimActions.innerHTML = `
                            
                            <div class="claim-fields visible">
                                <input type="text" class="claimer-name" value="${item.takenBy}" readonly="true">
                                <span class="claim-toggle" disabled="true">已認領</span>
                            </div>
                        `;
                    } else {
                        claimActions.innerHTML = `
                            <div class="claim-fields visible">
                                <input type="text" class="taken-by" placeholder="您的大名 💕">
                                <button class="save-button" disabled>認領</button>
                            </div>
                        `;
                        // Reattach event listeners for the new elements
                        attachClaimListeners(itemElement, item.id);
                    }
                }
            }
        }
    });
    
    // Log update summary
    if (updatedItems.size > 0) {
        console.log(`Updated ${updatedItems.size} items:`, Array.from(updatedItems));
    }
    
    // Reapply filters after update
    filterAndSearchItems();
}

// Helper function to attach claim listeners
function attachClaimListeners(itemElement, itemId) {
    const saveButton = itemElement.querySelector('.save-button');
    if (saveButton) {
        const nameInput = itemElement.querySelector('.taken-by');
        const itemStatus = itemElement.querySelector('.product-status');
        
        const updateSaveButtonState = () => {
            const nameValue = nameInput.value.trim();
            saveButton.disabled = !nameValue;
        };

        nameInput.addEventListener('input', updateSaveButtonState);
        
        saveButton.addEventListener('click', async () => {
            const claimer = nameInput.value.trim();
            if (claimer) {
                try {
                    saveButton.textContent = 'Saving...';
                    saveButton.disabled = true;
                    nameInput.disabled = true;

                    await claimItem(itemId, claimer);
                    
                    saveButton.textContent = '已認領';

                    // Show success modal using the imported function
                    showClaimSuccessModal();
                    itemStatus.classList.remove('available');
                    itemStatus.classList.add('taken');
                    itemStatus.textContent = 'Taken';
                } catch (error) {
                    saveButton.textContent = '認領';
                    saveButton.disabled = false;
                    nameInput.disabled = false;
                    updateSaveButtonState();
                }
            }
        });

        updateSaveButtonState();
    }
}

function attachControlListeners() {
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');

    expandAll.addEventListener('click', (e) => {
        if (expandAll.checked) {
            collapseAll.checked = false;
            collapseAll.indeterminate = false;
            document.querySelectorAll('.category-items').forEach(items => items.classList.add('active'));
            document.querySelectorAll('.category h2').forEach(h2 => h2.classList.add('active'));
        }
    });

    collapseAll.addEventListener('click', () => {
        if (collapseAll.checked) {
            expandAll.checked = false;
            expandAll.indeterminate = false;
            document.querySelectorAll('.category-items').forEach(items => items.classList.remove('active'));
            document.querySelectorAll('.category h2').forEach(h2 => h2.classList.remove('active'));
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

function updateControlCheckboxesState() {
    const categoryItems = document.querySelectorAll('.category-items');
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');
    const totalCategories = categoryItems.length;

    let activeCount = document.querySelectorAll('.category h2.active').length;;
    
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

async function start() {
    // Wait for configuration to load
    await loadConfig();
    
    // Initialize modal
    initModal();
    
    // Then load items
    loadItems().then(() => {
        // Initial state check after items are loaded and rendered
        console.log('initial state update');
        updateControlCheckboxesState();
    });
    attachControlListeners();
}

window.addEventListener('load', start);
