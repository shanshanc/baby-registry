// Add filter and search state
let currentFilter = 'all';
let currentSearch = '';

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

function initFilters() {
    // Attach listeners
    attachFilterListeners();
    attachSearchListener();
}

export { initFilters, filterAndSearchItems, updateControlCheckboxesState };
