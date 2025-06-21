import { Category, CategoryToSubcategories } from './types.js';
import { translate, loadTranslations } from './util.js';

// Builds the static HTML structure for categories and subcategories
async function createCategoryHTMLStructure(allCategoriesShouldBeActive = true) {
    let categoryHeadersHTML = '';
    let itemsDisplayHTML = '';
    
    Object.values(Category).forEach(categoryName => {
        const isActive = allCategoriesShouldBeActive;
        
        categoryHeadersHTML += `
            <div class="category">
                <h2 class="cat-${categoryName.toLowerCase()} ${isActive ? 'active' : ''}" data-category="${categoryName}">
                    ${translate('Category.' + categoryName)}
                </h2>
            </div>`;

        let subcategoriesRenderedHTML = '';
        const predefinedSubcats = CategoryToSubcategories[categoryName];

        if (predefinedSubcats && predefinedSubcats.length > 0) {
            predefinedSubcats.forEach(subcatName => {
                subcategoriesRenderedHTML += `
                    <div class="subcategory sub-${subcatName}">
                        <h3>${translate('Subcategory.' + subcatName)}</h3>
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
    });

    return { categoryHeadersHTML, itemsDisplayHTML };
}

// Initializes the category DOM structure (headers and empty item containers)
async function initCategories() {
    await loadTranslations();
    
    const categoryContainer = document.getElementById('category-container');
    const itemsContainer = document.getElementById('items-container');

    if (!categoryContainer || !itemsContainer) {
        console.error("Category or items container not found in DOM for initCategories.");
        return;
    }

    // Create HTML for categories (headers) and subcategory structure (item display areas)
    // Default: all categories active
    const { categoryHeadersHTML, itemsDisplayHTML } = await createCategoryHTMLStructure(true);

    categoryContainer.innerHTML = categoryHeadersHTML;
    
    // Create a wrapper div for the items display content
    const itemsDisplayWrapper = document.createElement('div');
    itemsDisplayWrapper.id = 'items-display-wrapper';
    itemsDisplayWrapper.innerHTML = itemsDisplayHTML;
    
    // Append the wrapper to container, which has loading skeleton already in the HTML
    itemsContainer.appendChild(itemsDisplayWrapper);
}

export { initCategories };
