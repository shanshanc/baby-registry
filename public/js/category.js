import { Category, CategoryZH, SubcategoryZH, CATEGORY_TO_SUBCATEGORIES } from './types.js';

// Builds the static HTML structure for categories and subcategories
function createCategoryHTMLStructure(firstCategoryShouldBeActive = false) {
    let categoryHeadersHTML = '';
    let itemsDisplayHTML = '';
    let isFirstCategoryInLoop = true;
    
    // Create a custom dropdown for mobile
    let mobileDropdownHTML = `
        <div class="mobile-category-dropdown">
            <div class="dropdown-header">
                <span>選擇分類</span>
                <svg viewBox="0 0 24 24" class="dropdown-arrow"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="dropdown-options">`;

    Object.values(Category).forEach(categoryName => {
        const isActive = firstCategoryShouldBeActive && isFirstCategoryInLoop;
        
        categoryHeadersHTML += `
            <div class="category">
                <h2 class="cat-${categoryName.toLowerCase()} ${isActive ? 'active' : ''}" data-category="${categoryName}">
                    ${CategoryZH[categoryName]}
                </h2>
            </div>`;

        // Add checkbox option to mobile dropdown
        mobileDropdownHTML += `
            <label class="dropdown-option">
                <input type="checkbox" value="${categoryName}" ${isActive ? 'checked' : ''}>
                <span>${CategoryZH[categoryName]}</span>
            </label>`;

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
        
        if (isFirstCategoryInLoop) {
            isFirstCategoryInLoop = false;
        }
    });

    // Close the dropdown container
    mobileDropdownHTML += `
            </div>
        </div>`;
    
    categoryHeadersHTML = mobileDropdownHTML + categoryHeadersHTML;

    return { categoryHeadersHTML, itemsDisplayHTML };
}

// Initialize mobile dropdown functionality
function initMobileDropdown() {
    const dropdown = document.querySelector('.mobile-category-dropdown');
    if (!dropdown) return;

    // Toggle dropdown open/close when clicking the header
    const dropdownHeader = dropdown.querySelector('.dropdown-header');
    if (dropdownHeader) {
        dropdownHeader.addEventListener('click', () => {
            dropdown.classList.toggle('open');
        });
    }

    // Handle checkbox changes
    dropdown.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const categoryName = e.target.value;
            const isChecked = e.target.checked;
            
            // Update category headers
            const header = document.querySelector(`.category h2[data-category="${categoryName}"]`);
            if (header) {
                header.classList.toggle('active', isChecked);
            }

            // Update category items display
            const items = document.querySelector(`.category-items[data-category="${categoryName}"]`);
            if (items) {
                items.classList.toggle('active', isChecked);
            }
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
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
    const { categoryHeadersHTML, itemsDisplayHTML } = createCategoryHTMLStructure(true);

    categoryContainer.innerHTML = categoryHeadersHTML;
    
    // Create a wrapper div for the items display content
    const itemsDisplayWrapper = document.createElement('div');
    itemsDisplayWrapper.id = 'items-display-wrapper';
    itemsDisplayWrapper.innerHTML = itemsDisplayHTML;
    
    // Append the wrapper to container, which has loading skeleton already in the HTML
    itemsContainer.appendChild(itemsDisplayWrapper);

    // Initialize mobile dropdown functionality
    initMobileDropdown();
}

export { initCategories };
