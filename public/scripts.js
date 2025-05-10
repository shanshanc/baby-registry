import mockItems from './data/items.js';
import { Category, Subcategory, CATEGORY_TO_SUBCATEGORIES } from './types.js';

function toggleItems(itemEle) {
    // Toggle the selected category header
    const selectedCategory = itemEle.innerText;
    itemEle.classList.toggle('active');

    // Toggle the selected subcategory items container
    const subcategoryItems = document.querySelector(`.category-items[data-category="${selectedCategory}"]`);
    if (subcategoryItems) {
        subcategoryItems.classList.toggle('active');
    }

    // Update the master control checkboxes
    updateControlCheckboxesState();
}

async function claimItem(itemId, claimer, email) {
    try {
        const response = await fetch(CONFIG.api.endpoints.claim, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                item: itemId, 
                claimer,
                email 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || MESSAGES.errors.claim.en);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error claiming item:', error);
        alert(MESSAGES.errors.claim.en);
    }
}

async function loadItemsAndClaims() {
    const categoryContainer = document.getElementById('category-container');
    const itemsContainer = document.getElementById('items-container');
    
    try {
        // Check if we're in a local environment
        const isLocalEnvironment = window.location.hostname === 'localhost' || 
                                   window.location.hostname === '127.0.0.1' ||
                                   window.location.protocol === 'file:';
        
        // Fetch items and claims in parallel
        let itemsPromise;
        if (isLocalEnvironment) {
            // Use mockItems for local development
            console.log('Using mock items in local environment');
            itemsPromise = Promise.resolve(mockItems);
        } else {
            // In production, fetch from API
            itemsPromise = fetch(CONFIG.api.endpoints.items)
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(errorData => {
                            throw new Error(errorData.message || MESSAGES.errors.generic.en);
                        });
                    }
                    return response.json();
                });
        }
        
        // Fetch claims
        const claimsPromise = fetch(CONFIG.api.endpoints.claims)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(errorData.error || MESSAGES.errors.generic.en);
                    });
                }
                return response.json();
            })
            .catch(error => {
                console.error('Error loading claims:', error);
                return {}; // Return empty object if claims can't be loaded
            });
            
        // Wait for both promises to resolve
        const [items, claims] = await Promise.all([itemsPromise, claimsPromise]);
        // Merge claims data with items
        const itemsWithClaims = items.map(item => {
            const claim = claims[item.id];
            if (claim) {
                return {
                    ...item,
                    claimerEmail: claim.email || '',
                    verifiedClaim: claim.verified || false
                };
            }
            return item;
        });
        
        categoryContainer.innerHTML = '';
        itemsContainer.innerHTML = '';
        
        // Initialize categories object from Category enum
        const categories = {};
        for (const catKey in Category) {
            categories[Category[catKey]] = {}; // Initialize with empty subcategories
        }

        // Group items by category and subcategory
        itemsWithClaims.forEach(item => {
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
            categoryDiv.innerHTML = `<h2 class="${firstCategory ? 'active' : ''}">${categoryName}</h2>`;
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
                    currentSubcategoryHTML += `<div class="subcategory">${subcategoryName}</div>`;
                    
                    // Add all items under this subcategory
                    let itemsHTML = '';
                    subcategoryItems.forEach(item => {
                        itemsHTML += createItemHTML(item.id, item.product, item.url, item);
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
                    // Disable button if name is empty or email is empty/invalid
                    saveButton.disabled = !nameValue;
                };

                // Add input listeners to check field values
                nameInput.addEventListener('input', updateSaveButtonState);

                // Add click listener to the save button
                saveButton.addEventListener('click', async () => {
                    const claimer = nameInput.value.trim();

                    // Double-check values before claiming (though button should be disabled if invalid)
                    if (claimer && email) {
                        try {
                            // Optional: Add visual feedback (e.g., disable fields, show spinner)
                            saveButton.textContent = 'Saving...';
                            saveButton.disabled = true;
                            nameInput.disabled = true;

                            await claimItem(itemId, claimer, email);
                            
                            // Update UI to show success message
                            const feedbackSpan = itemDiv.querySelector('.feedback-message');
                            feedbackSpan.textContent = 'Item claimed successfully! Please check your email to confirm.';
                            feedbackSpan.style.display = 'inline-block';
                            
                            // Hide the claim toggle message
                            const claimToggle = itemDiv.querySelector('.claim-toggle');
                            if (claimToggle) {
                                claimToggle.style.display = 'none';
                            }
                            
                            // Keep inputs disabled
                            saveButton.disabled = true;
                            nameInput.disabled = true;
                            saveButton.textContent = 'Saved';
                        } catch (error) {
                            // Re-enable fields if claim fails
                            saveButton.textContent = 'Save';
                            // Re-enable based on current input state might be better
                            saveButton.disabled = false;
                            nameInput.disabled = false;
                            updateSaveButtonState();
                        }
                    }
                });

                // Initial check
                updateSaveButtonState();
            }
        });
        
        // Set up periodic refresh for claims only
        setInterval(async () => {
            try {
                const updatedClaims = await fetch(CONFIG.api.endpoints.claims).then(r => r.json());
                updateUIWithClaims(updatedClaims);
            } catch (error) {
                console.error('Error refreshing claims:', error);
            }
        }, CONFIG.refreshInterval);
        
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

// Add a new function to update UI with claims data without rerendering everything
function updateUIWithClaims(claims) {
    Object.entries(claims).forEach(([itemId, claim]) => {
        const itemElement = document.querySelector(`[data-item="${itemId}"]`);
        if (itemElement) {
            const claimToggle = itemElement.querySelector('.claim-toggle');
            const statusSpan = itemElement.querySelector('.product-status');
            
            if (claim) {
                // Update status
                if (statusSpan) {
                    statusSpan.textContent = 'Taken';
                    statusSpan.classList.remove('available');
                    statusSpan.classList.add('taken');
                }
                
                if (claimToggle) {
                    if (claim.verified) {
                        claimToggle.textContent = 'Taken by';
                    } else {
                        claimToggle.textContent = 'Verifying';
                    }
                    claimToggle.setAttribute('disabled', 'true');
                }
                
                // Disable the save button if it exists
                const saveButton = itemElement.querySelector('.save-button');
                if (saveButton) {
                    saveButton.disabled = true;
                    saveButton.textContent = 'Claimed';
                }
                
                // Disable the name input if it exists
                const nameInput = itemElement.querySelector('.taken-by');
                if (nameInput) {
                    nameInput.disabled = true;
                }
            }
        }
    });
}

function createItemHTML(itemId, itemName, itemUrl, item) {
    console.log('[Debug] item', item);
    
    // Special handling for Donate category items
    if (item.category === 'Donate') {
        return `
            <div class="item" data-item="${itemId}">
                <div class="item-content donate-info">
                    <div class="donate-message">若沒有適合的禮物，也很歡迎捐贈現金，我們會用來購買其他寶寶用品。</div>
                    ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${itemName}" class="donate-image">` : ''}
                </div>
            </div>
        `;
    }
    
    // Regular item handling
    const statusSpan = item.claimer ? `<span class="product-status taken">Taken</span>` : `<span class="product-status available">Available</span>`;
    const claimFields = item.claimer ?
    `<div class="claim-actions">
        <span class="claim-toggle" disabled="true">Taken by</span>
        <div class="claim-fields visible">
            <input type="email" class="claimer-name" value=${item.claimer} readonly="true">
        </div>
    </div>`: `<div class="claim-actions">
        <div class="claim-fields visible">
            <input type="text" class="taken-by" placeholder="您的大名❤️">
            <button class="save-button" disabled>Save</button>
        </div>
    </div>`;
    
    return `
        <div class="item" data-item="${itemId}">
            <div class="item-content">
                ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${itemName}" class="item-image">` : ''}
                <div class="item-details">
                    <div class="product-header">
                        ${itemUrl ? `<a href="${itemUrl}" class="product-name" target="_blank" rel="">${item.productZH}</a>` : ''}
                        ${statusSpan}
                    </div>
                    ${itemUrl ? `<div class="product-url"><span>查看產品: </span><a href="${itemUrl}" class="product-url" target="_blank" rel="">連結</a></div>` : ''}
                    ${item.price ? `<div class="product-price">$${item.price}</div>` : ''}
                    ${claimFields}
                </div>
            </div>
        </div>
    `;
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

function start() {
    loadItemsAndClaims().then(() => {
        // Initial state check after items are loaded and rendered
        console.log('initial state update');
        updateControlCheckboxesState();
    });
    attachControlListeners();
}

window.addEventListener('load', start);
