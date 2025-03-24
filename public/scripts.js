
function toggleItems(header) {
  const items = header.nextElementSibling;
  items.classList.toggle('active');
}

async function loadItemsAndClaims() {
  // Fetch items with the new structure
  const itemsResponse = await fetch('./data/items.json');
  const categories = await itemsResponse.json();
  console.log('loadItems');

  // Fetch claims (commented out as in original)
  //const claimsResponse = await fetch('/api/get-claims');
  //const claims = await claimsResponse.json();

  const registryDiv = document.getElementById('registry');

  // Render categories
  categories.forEach(category => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category';
    categoryDiv.innerHTML = `<h2 onclick="toggleItems(this)">${category.name}</h2>`;
    
    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'items';

    // Process each item in this category
    category.items.forEach(item => {
      if (typeof item === 'string') {
        // Direct item under category (no subcategory)
        const itemId = generateItemId(item);
        itemsDiv.innerHTML += `
          <div class="item" data-item="${itemId}">
            <input type="checkbox" id="${itemId}">
            <label for="${itemId}">${item}</label>
            <input type="text" class="taken-by" value="" placeholder="Taken by">
          </div>
        `;
      } else {
        // This is a subcategory with its own items
        itemsDiv.innerHTML += `<div class="subcategory">${item.name}</div>`;
        
        // Add all items in this subcategory
        item.items.forEach(subItem => {
          const itemId = generateItemId(subItem);
          itemsDiv.innerHTML += `
            <div class="item" data-item="${itemId}">
              <input type="checkbox" id="${itemId}">
              <label for="${itemId}">${subItem}</label>
              <input type="text" class="taken-by" value="" placeholder="Taken by">
            </div>
          `;
        });
      }
    });
    
    categoryDiv.appendChild(itemsDiv);
    registryDiv.appendChild(categoryDiv);
  });
}

// Helper function to generate IDs from item names
function generateItemId(itemName) {
  return itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/(^-|-$)/g, ''); // Remove leading/trailing hyphens
}

window.addEventListener('load', loadItemsAndClaims);