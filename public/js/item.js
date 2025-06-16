import { Category, CategoryToSubcategories, ClaimText } from './types.js';
import { MESSAGES } from './constants.js';
import { createOptimizedImage } from './imageOptimizer.js';

function createItemHTML(item) {
    const productName = item.product.toLowerCase().replace(/ /g, '-');
    
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
                <div class="image-container">
                    <div class="preview">
                        ${item.imageUrl ? createOptimizedImage(
                            item.imageUrl,
                            item.imageUrlWebp,
                            {
                              alt: productName
                            }
                          ) : ''}
                    </div>
                </div>
                <div class="item-details">
                    <div class="product-header">
                        ${item.url ? `<a href="${item.url}" class="product-name" target="_blank" rel="">${item.productZH}</a>` : ''}
                        ${statusSpan}
                    </div>
                    ${item.url ? `<div class="product-url"><span>查看產品: </span><a href="${item.url}" class="product-url" target="_blank" rel="">連結</a></div>` : ''}
                    ${item.price ? `<div class="product-price">$${getFormattedPriceString(item.price)}<span class="price-info-icon" data-tooltip="${MESSAGES.priceInfo}"><i class="fa-solid fa-circle-info"></i></span></div>` : ''}
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
    
    // Initialize the structure based on Category and CategoryToSubcategories
    Object.values(Category).forEach(categoryName => {
        groupedItems[categoryName] = {};
        
        // Get the predefined subcategories for this category
        const predefinedSubcats = CategoryToSubcategories[categoryName];
        
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
            const subcategoryKey = item.subcategory || "None";
            
            if (groupedItems[item.category].hasOwnProperty(subcategoryKey)) {
                groupedItems[item.category][subcategoryKey].push(item);
            } else if (groupedItems[item.category].hasOwnProperty("None")) {
                // If subcategory isn't found but we have a default container, use that
                groupedItems[item.category]["None"].push(item);
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
                // Find the related subcategory header
                const subcategoryHeader = itemsListContainer.previousElementSibling;
                
                if (itemList.length > 0) {
                    // Show the subcategory header if it exists and has items
                    if (subcategoryHeader && subcategoryHeader.classList.contains('subcategory')) {
                        subcategoryHeader.style.display = '';
                    }
                    
                    let itemsHTML = '';
                    itemList.forEach(item => {
                        itemsHTML += createItemHTML(item);
                    });
                    itemsListContainer.innerHTML = itemsHTML;
                    itemsListContainer.style.display = ''; // Show the items container
                } else {
                    // No items for this subcategory - hide the header and container
                    if (subcategoryHeader && subcategoryHeader.classList.contains('subcategory')) {
                        subcategoryHeader.style.display = 'none';
                    }
                    
                    // If it's a default subcategory for a category without defined subcategories,
                    // we'll show the no-items message instead of hiding entirely
                    const isDefaultSubcategory = subcategoryName === 'default';
                    const hasNoDefinedSubcategories = !(CategoryToSubcategories[categoryName] && CategoryToSubcategories[categoryName].length > 0);
                    
                    if (isDefaultSubcategory && hasNoDefinedSubcategories) {
                        const containerType = 'category';
                        itemsListContainer.innerHTML = `<p class="no-items-message">No items in this ${containerType} yet.</p>`;
                        itemsListContainer.style.display = ''; // Show the container to display the message
                    } else {
                        // Hide the items container for an empty subcategory
                        itemsListContainer.style.display = 'none';
                    }
                }
            } else {
                console.warn(`Items list container not found for category '${categoryName}' and subcategory '${subcategoryName}'`);
            }
        });
    });
    
    return groupedItems; // Return the grouped structure in case it's needed elsewhere
}

function getFormattedPriceString(priceValue) {
  if (priceValue === null || typeof priceValue === 'undefined') {
      return ''; 
  }
  const num = parseInt(priceValue, 10);
  if (isNaN(num)) {
      return priceValue.toString();
  }
  return num > 1000 ? num.toLocaleString('en-US') : num.toString();
}

export { createItemHTML, renderItems };
