function toggleItems(header) {
  const items = header.nextElementSibling;
  items.classList.toggle('active');
}

async function claimItem(itemId, claimer) {
  try {
    const response = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: itemId, claimer })
    });
    
    if (!response.ok) {
      throw new Error('Failed to claim item');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error claiming item:', error);
    alert('Failed to claim item. Please try again.');
  }
}

async function loadClaims() {
  try {
    const response = await fetch('/api/claims');
    if (!response.ok) {
      throw new Error('Failed to fetch claims');
    }
    const claims = await response.json();
    
    // Update UI with claims
    Object.entries(claims).forEach(([itemId, claimer]) => {
      const itemElement = document.querySelector(`[data-item="${itemId}"]`);
      if (itemElement) {
        const checkbox = itemElement.querySelector('input[type="checkbox"]');
        const claimerInput = itemElement.querySelector('.taken-by');
        if (claimer) {
          checkbox.checked = true;
          claimerInput.value = claimer;
        }
      }
    });
  } catch (error) {
    console.error('Error loading claims:', error);
  }
}

async function loadItemsAndClaims() {
  try {
    // Fetch items
    const itemsResponse = await fetch('./data/items.json');
    const categories = await itemsResponse.json();
    
    const registryDiv = document.getElementById('registry');
    registryDiv.innerHTML = ''; // Clear existing content

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
          const itemId = generateItemId(item);
          itemsDiv.innerHTML += createItemHTML(itemId, item);
        } else {
          // Subcategory
          itemsDiv.innerHTML += `<div class="subcategory">${item.name}</div>`;
          item.items.forEach(subItem => {
            const itemId = generateItemId(subItem);
            itemsDiv.innerHTML += createItemHTML(itemId, subItem);
          });
        }
      });
      
      categoryDiv.appendChild(itemsDiv);
      registryDiv.appendChild(categoryDiv);
    });

    // Add event listeners to all claim inputs
    document.querySelectorAll('.taken-by').forEach(input => {
      input.addEventListener('change', async (e) => {
        const itemDiv = e.target.closest('.item');
        const itemId = itemDiv.dataset.item;
        const claimer = e.target.value.trim();
        
        if (claimer) {
          const checkbox = itemDiv.querySelector('input[type="checkbox"]');
          checkbox.checked = true;
          await claimItem(itemId, claimer);
        }
      });
    });

    // Load initial claims
    await loadClaims();
    
    // Periodically refresh claims
    setInterval(loadClaims, 30000); // Refresh every 30 seconds
    
  } catch (error) {
    console.error('Error loading registry:', error);
    registryDiv.innerHTML = '<p>Error loading registry. Please refresh the page.</p>';
  }
}

function createItemHTML(itemId, itemName) {
  return `
    <div class="item" data-item="${itemId}">
      <input type="checkbox" id="${itemId}">
      <label for="${itemId}">${itemName}</label>
      <input type="text" class="taken-by" value="" placeholder="Taken by">
    </div>
  `;
}

function generateItemId(itemName) {
  return itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

window.addEventListener('load', loadItemsAndClaims);