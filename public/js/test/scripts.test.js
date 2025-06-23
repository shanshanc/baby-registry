import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// We need to mock the imported modules since they aren't available in the test environment
vi.mock('../constants.js', () => ({
  CONFIG: { api: { endpoints: { items: 'http://localhost/api/items' } }, refreshInterval: 30000 },
  MESSAGES: { errors: { generic: 'Error occurred' } },
  DEBUG_MODE: false
}));

vi.mock('../util.js', () => ({
  loadConfig: vi.fn(() => Promise.resolve()),
  translate: vi.fn((key) => key)
}));

vi.mock('../modal.js', () => ({
  initModal: vi.fn()
}));

vi.mock('../filter.js', () => ({
  initFilters: vi.fn(),
  filterAndSearchItems: vi.fn(),
  updateControlCheckboxesState: vi.fn(),
  updateFilterState: vi.fn(),
  updateSearchState: vi.fn()
}));

vi.mock('../category.js', () => ({
  initCategories: vi.fn(() => Promise.resolve())
}));

vi.mock('../item.js', () => ({
  renderItems: vi.fn()
}));

vi.mock('../itemManager.js', () => ({
  default: {}
}));

vi.mock('../imageOptimizer.js', () => ({
  initLazyLoading: vi.fn(),
  testFallbacks: vi.fn(),
  supportsWebP: vi.fn()
}));

describe('initializeExpandCollapseControls', () => {
  let dom;
  let document;
  let window;
  let initializeExpandCollapseControls;

  beforeEach(async () => {
    // Create a JSDOM instance with the necessary HTML structure
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="controls">
            <input type="checkbox" id="expand-all"> 展開全部
            <input type="checkbox" id="collapse-all"> 收起全部
          </div>
          <div id="category-container">
            <div class="category">
              <h2 class="cat-feeding active" data-category="FEEDING">餵食用品</h2>
            </div>
            <div class="category">
              <h2 class="cat-bathing active" data-category="BATHING">洗澡用品</h2>
            </div>
            <div class="category">
              <h2 class="cat-sleeping active" data-category="SLEEPING">睡眠用品</h2>
            </div>
          </div>
          <div id="items-container">
            <div class="category-items active" data-category="FEEDING">
              <div class="items-list" data-category-name="FEEDING" data-subcategory-name="default">
                <div class="item" data-item="item1">
                  <div class="item-content">Test Item 1</div>
                </div>
                <div class="item" data-item="item2">
                  <div class="item-content">Test Item 2</div>
                </div>
              </div>
            </div>
            <div class="category-items active" data-category="BATHING">
              <div class="items-list" data-category-name="BATHING" data-subcategory-name="default">
                <div class="item" data-item="item3">
                  <div class="item-content">Test Item 3</div>
                </div>
              </div>
            </div>
            <div class="category-items active" data-category="SLEEPING">
              <div class="items-list" data-category-name="SLEEPING" data-subcategory-name="default">
                <div class="item" data-item="item4">
                  <div class="item-content">Test Item 4</div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost' });

    document = dom.window.document;
    window = dom.window;

    // Set up global DOM
    global.document = document;
    global.window = window;

    // Import the function from scripts module
    const { initializeExpandCollapseControls: importedFunction } = await import('../scripts.js');
    initializeExpandCollapseControls = importedFunction;
  });

  afterEach(() => {
    // Clean up globals
    delete global.document;
    delete global.window;
    vi.clearAllMocks();
  });

  it('should set expand-all checkbox to checked and not indeterminate', () => {
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');

    // Verify initial state (before calling the function)
    expect(expandAll.checked).toBe(false);
    expect(expandAll.indeterminate).toBe(false);

    // Call the function
    initializeExpandCollapseControls();

    // Verify expand-all is properly set
    expect(expandAll.checked).toBe(true);
    expect(expandAll.indeterminate).toBe(false);
  });

  it('should set collapse-all checkbox to unchecked and not indeterminate', () => {
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');

    // Verify initial state
    expect(collapseAll.checked).toBe(false);
    expect(collapseAll.indeterminate).toBe(false);

    // Call the function
    initializeExpandCollapseControls();

    // Verify collapse-all is properly set
    expect(collapseAll.checked).toBe(false);
    expect(collapseAll.indeterminate).toBe(false);
  });

  it('should work correctly when checkboxes exist', () => {
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');

    // Verify elements exist
    expect(expandAll).toBeTruthy();
    expect(collapseAll).toBeTruthy();

    // Call the function
    initializeExpandCollapseControls();

    // Verify both checkboxes are in the correct state
    expect(expandAll.checked).toBe(true);
    expect(expandAll.indeterminate).toBe(false);
    expect(collapseAll.checked).toBe(false);
    expect(collapseAll.indeterminate).toBe(false);
  });

  it('should handle gracefully when checkboxes do not exist', () => {
    // Remove the checkboxes from DOM
    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');
    expandAll.remove();
    collapseAll.remove();

    // The function should not throw an error
    expect(() => {
      initializeExpandCollapseControls();
    }).not.toThrow();
  });

  it('should ensure that all items are visible when all categories are active (default state)', () => {
    // Call the function to set up the default state
    initializeExpandCollapseControls();

    // Verify that all category headers have 'active' class
    const categoryHeaders = document.querySelectorAll('.category h2');
    categoryHeaders.forEach(header => {
      expect(header.classList.contains('active')).toBe(true);
    });

    // Verify that all category-items containers have 'active' class
    const categoryItems = document.querySelectorAll('.category-items');
    categoryItems.forEach(items => {
      expect(items.classList.contains('active')).toBe(true);
    });

    // Verify that all items are visible (not hidden with display: none)
    const allItems = document.querySelectorAll('.item');
    allItems.forEach(item => {
      // Items should not have display: none style
      expect(item.style.display).not.toBe('none');
    });

    // Verify that we have the expected number of items
    expect(allItems.length).toBe(4); // Based on our test HTML structure

    // Verify that items are in active category containers
    const activeCategories = document.querySelectorAll('.category-items.active');
    expect(activeCategories.length).toBe(3); // FEEDING, BATHING, SLEEPING

    // Count items in active categories
    let itemsInActiveCategories = 0;
    activeCategories.forEach(category => {
      const itemsInCategory = category.querySelectorAll('.item');
      itemsInActiveCategories += itemsInCategory.length;
    });
    expect(itemsInActiveCategories).toBe(4); // All items should be in active categories
  });

  it('should correctly represent the default page load state', () => {
    // This test verifies that the function sets up the controls to match
    // what users should see when the page first loads - all items visible

    initializeExpandCollapseControls();

    const expandAll = document.getElementById('expand-all');
    const collapseAll = document.getElementById('collapse-all');

    // The expand-all should be checked since all categories are expanded by default
    expect(expandAll.checked).toBe(true);
    expect(expandAll.indeterminate).toBe(false);

    // The collapse-all should be unchecked since no categories are collapsed
    expect(collapseAll.checked).toBe(false);
    expect(collapseAll.indeterminate).toBe(false);

    // This state should correspond to all items being visible
    const visibleCategoryItems = document.querySelectorAll('.category-items.active');
    const totalCategoryItems = document.querySelectorAll('.category-items');
    
    // All category items should be active/visible
    expect(visibleCategoryItems.length).toBe(totalCategoryItems.length);
    
    // All category headers should be active
    const activeCategoryHeaders = document.querySelectorAll('.category h2.active');
    const totalCategoryHeaders = document.querySelectorAll('.category h2');
    expect(activeCategoryHeaders.length).toBe(totalCategoryHeaders.length);
  });
}); 