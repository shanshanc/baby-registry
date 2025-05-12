import { Category, CATEGORY_TO_SUBCATEGORIES, ClaimText } from './types.js';
import { DONATE_QR_FALLBACK } from './constants.js';
import { createOptimizedImage } from './imageOptimizer.js';

function createItemHTML(item) {
    const productName = item.product.toLowerCase().replace(/ /g, '-');
    // Special handling for Donate category items
    if (item.category === 'Donate') {
        return `
            <div class="item" data-item="${item.id}">
                <div class="item-content donate-info" data-product="donate">
                    <div class="donate-message">若沒有適合的禮物，也很歡迎捐贈現金，我們會用來購買其他寶寶用品。</div>
                    ${createOptimizedImage(item.imageUrl || DONATE_QR_FALLBACK, "Donate QR Code", "donate-qr-code donate-image")}
                </div>
            </div>
        `;
    }
    
    // Regular item handling
    const statusSpan = item.takenBy ? `<span class="product-status taken">${ClaimText.TAKEN}</span>` : `<span class="product-status available">${ClaimText.AVAILABLE}</span>`;
    const claimFields = item.takenBy ?
    `<div class="claim-fields visible">
        <input type="text" class="claimer-name" value="${item.takenBy}" readonly="true">
        <span class="claimed-badge">${ClaimText.CLAIMED}</span>
    </div>`: `<div class="claim-fields visible">
        <input type="text" class="taken-by" placeholder="您的大名 💕">
        <button class="save-button" disabled>${ClaimText.CLAIM}</button>
    </div>`;

    const productNameEn = item.product.toLowerCase().replace(/ /g, '-').trim();
    const productNameZH = item.productZH.trim();
    
    return `
        <div class="item" data-item="${item.id}">
            <div class="item-content" data-product="${productNameEn} ${productNameZH}">
                ${item.imageUrl ? createOptimizedImage(item.imageUrl, productName, "item-image") : ''}
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

// Renders items into the DOM structure based on category and subcategory
function renderItems(items) {
    // First, group items by category and subcategory
    const groupedItems = {};
    
    // Initialize the structure based on Category and CATEGORY_TO_SUBCATEGORIES
    Object.values(Category).forEach(categoryName => {
        groupedItems[categoryName] = {};
        
        // Get the predefined subcategories for this category
        const predefinedSubcats = CATEGORY_TO_SUBCATEGORIES[categoryName];
        
        if (predefinedSubcats && predefinedSubcats.length > 0) {
            // Initialize each predefined subcategory with an empty array
            predefinedSubcats.forEach(subcatName => {
                groupedItems[categoryName][subcatName] = [];
            });
        } else {
            // For categories without predefined subcategories, add a default container
            groupedItems[categoryName]["default"] = [];
        }
    });
    
    // Populate the structure with items
    items.forEach(item => {
        if (item.category && groupedItems[item.category]) {
            const subcategoryKey = item.subcategory || "default";
            
            if (groupedItems[item.category].hasOwnProperty(subcategoryKey)) {
                groupedItems[item.category][subcategoryKey].push(item);
            } else if (groupedItems[item.category].hasOwnProperty("default")) {
                // If subcategory isn't found but we have a default container, use that
                groupedItems[item.category]["default"].push(item);
            } else {
                console.warn(`Item's subcategory '${subcategoryKey}' not found for category '${item.category}' and no default container available`);
            }
        } else {
            console.warn(`Item with unknown or missing category: ${item.category}`);
        }
    });
    
    // Now render items into their containers
    const itemsDisplayWrapper = document.getElementById('items-display-wrapper');
    if (!itemsDisplayWrapper) {
        console.error('Items display wrapper not found');
        return groupedItems;
    }

    Object.entries(groupedItems).forEach(([categoryName, subcategories]) => {
        Object.entries(subcategories).forEach(([subcategoryName, itemList]) => {
            const itemsListContainer = itemsDisplayWrapper.querySelector(`.items-list[data-category-name="${categoryName}"][data-subcategory-name="${subcategoryName}"]`);
            
            if (itemsListContainer) {
                if (itemList.length > 0) {
                    let itemsHTML = '';
                    itemList.forEach(item => {
                        itemsHTML += createItemHTML(item);
                    });
                    itemsListContainer.innerHTML = itemsHTML;
                } else {
                    // No items for this subcategory - show a message
                    const isDefaultSubcategory = subcategoryName === 'default';
                    const hasNoDefinedSubcategories = !(CATEGORY_TO_SUBCATEGORIES[categoryName] && CATEGORY_TO_SUBCATEGORIES[categoryName].length > 0);
                    const containerType = isDefaultSubcategory && hasNoDefinedSubcategories ? 'category' : 'subcategory';
                    
                    itemsListContainer.innerHTML = `<p class="no-items-message">No items in this ${containerType} yet.</p>`;
                }
            } else {
                console.warn(`Items list container not found for category '${categoryName}' and subcategory '${subcategoryName}'`);
            }
        });
    });
    
    return groupedItems; // Return the grouped structure in case it's needed elsewhere
}

export { createItemHTML, renderItems };
