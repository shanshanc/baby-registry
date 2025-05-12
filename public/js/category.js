import { Category, CategoryZH, SubcategoryZH, CATEGORY_TO_SUBCATEGORIES } from './types.js';

// Builds the static HTML structure for categories and subcategories
function createCategoryHTMLStructure(firstCategoryShouldBeActive = false) {
    let categoryHeadersHTML = '';
    let itemsDisplayHTML = '';
    let isFirstCategoryInLoop = true;

    Object.values(Category).forEach(categoryName => {
        const isActive = firstCategoryShouldBeActive && isFirstCategoryInLoop;
        
        categoryHeadersHTML += `
            <div class="category">
                <h2 class="cat-${categoryName.toLowerCase()} ${isActive ? 'active' : ''}" data-category="${categoryName}">
                    ${CategoryZH[categoryName]}
                </h2>
            </div>`;

        let subcategoriesRenderedHTML = '';
        const predefinedSubcats = CATEGORY_TO_SUBCATEGORIES[categoryName];

        if (predefinedSubcats && predefinedSubcats.length > 0) {
            predefinedSubcats.forEach(subcatName => {
                subcategoriesRenderedHTML += `
                    <div class="subcategory sub-${subcatName}">
                        <h3>${SubcategoryZH[subcatName] ? SubcategoryZH[subcatName] : subcatName}</h3>
                    </div>
                    <div class="items-list" data-category-name="${categoryName}" data-subcategory-name="${subcatName}">
                        <p class="no-items-message">No items in this subcategory yet.</p>
                    </div>`;
            });
        } else {
            // Category has no predefined subcategories, add a default items list for it
            subcategoriesRenderedHTML += `
                <div class="items-list" data-category-name="${categoryName}" data-subcategory-name="default">
                    <p class="no-items-message">No items in this category yet.</p>
                </div>`;
        }

        itemsDisplayHTML += `
            <div class="category-items ${isActive ? 'active' : ''}" data-category="${categoryName}">
                ${subcategoriesRenderedHTML}
            </div>`;
        
        if (isActive) {
            isFirstCategoryInLoop = false; // Ensure only the very first category is active if flag is true
        }
    });

    return { categoryHeadersHTML, itemsDisplayHTML };
}

// Initializes the category DOM structure (headers and empty item containers)
function initCategories() {
    const categoryContainer = document.getElementById('category-container');
    const itemsContainer = document.getElementById('items-container');

    if (!categoryContainer || !itemsContainer) {
        console.error("Category or items container not found in DOM for initCategories.");
        return;
    }

    // Create HTML for categories (headers) and subcategory structure (item display areas)
    const { categoryHeadersHTML, itemsDisplayHTML } = createCategoryHTMLStructure(true); // true to make the first category active

    categoryContainer.innerHTML = categoryHeadersHTML;
    
    // Create a wrapper div for the items display content
    const itemsDisplayWrapper = document.createElement('div');
    itemsDisplayWrapper.id = 'items-display-wrapper';
    itemsDisplayWrapper.innerHTML = itemsDisplayHTML;
    
    // Clear the items container but preserve the loading skeleton
    const loadingSkeleton = itemsContainer.querySelector('.loading-skeleton');
    itemsContainer.innerHTML = '';
    if (loadingSkeleton) {
        itemsContainer.appendChild(loadingSkeleton);
    }
    itemsContainer.appendChild(itemsDisplayWrapper);
}

export { initCategories };
