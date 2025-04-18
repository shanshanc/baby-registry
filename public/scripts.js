function toggleItems(header) {
  const items = header.nextElementSibling;
  items.classList.toggle('active');
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
    console.log('Claim successful:', result);
    return result;
  } catch (error) {
    console.error('Error claiming item:', error);
    alert(MESSAGES.errors.claim.en);
  }
}

async function loadClaims() {
  try {
    const response = await fetch(CONFIG.api.endpoints.claims);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || MESSAGES.errors.generic.en);
    }
    const claims = await response.json();
    console.log('Loaded claims:', claims);
    
    // Update UI with claims
    Object.entries(claims).forEach(([itemId, claim]) => {
      const itemElement = document.querySelector(`[data-item="${itemId}"]`);
      if (itemElement) {
        const checkbox = itemElement.querySelector('input[type="checkbox"]');
        const claimerInput = itemElement.querySelector('.taken-by');
        const emailInput = itemElement.querySelector('.claimer-email');
        
        if (claim) {
          checkbox.checked = true;
          if (typeof claim === 'string') {
            // Handle legacy claims that only have claimer name
            claimerInput.value = claim;
          } else {
            // Handle new claims with both name and email
            claimerInput.value = claim.claimer || '';
            emailInput.value = claim.email || '';
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading claims:', error);
  }
}

async function loadItemsAndClaims() {
  const itemsContainer = document.getElementById('items-container');
  
  try {
    const itemsResponse = await fetch(CONFIG.api.endpoints.items);
    if (!itemsResponse.ok) {
      const errorData = await itemsResponse.json();
      throw new Error(errorData.message || MESSAGES.errors.generic.en);
    }
    const items = await itemsResponse.json();
    
    itemsContainer.innerHTML = ''; // Clear only the items container

    // Group items by category
    const categories = {};
    items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = {};
      }
      if (!categories[item.category][item.subcategory]) {
        categories[item.category][item.subcategory] = [];
      }
      categories[item.category][item.subcategory].push(item);
    });

    // Render categories
    Object.entries(categories).forEach(([categoryName, subcategories]) => {
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'category';
      categoryDiv.innerHTML = `<h2 onclick="toggleItems(this)">${categoryName}</h2>`;
      
      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'items';

      // Render subcategories and items
      Object.entries(subcategories).forEach(([subcategoryName, subcategoryItems]) => {
        itemsDiv.innerHTML += `<div class="subcategory">${subcategoryName}</div>`;
        subcategoryItems.forEach(item => {
          itemsDiv.innerHTML += createItemHTML(item.id, item.product, item.url, item);
        });
      });
      
      categoryDiv.appendChild(itemsDiv);
      itemsContainer.appendChild(categoryDiv);
    });

    // Add event listeners to all claim inputs
    document.querySelectorAll('.taken-by').forEach(input => {
      input.addEventListener('change', async (e) => {
        const itemDiv = e.target.closest('.item');
        const itemId = itemDiv.dataset.item;
        const claimer = e.target.value.trim();
        const emailInput = itemDiv.querySelector('.claimer-email');
        const email = emailInput.value.trim();
        
        if (claimer && email) {
          const checkbox = itemDiv.querySelector('input[type="checkbox"]');
          checkbox.checked = true;
          await claimItem(itemId, claimer, email);
        } else if (!email) {
          alert(MESSAGES.errors.emailRequired.en + '\n' + MESSAGES.errors.emailRequired.zh);
        }
      });
    });

    // Add event listeners to email inputs
    document.querySelectorAll('.claimer-email').forEach(input => {
      input.addEventListener('change', async (e) => {
        const itemDiv = e.target.closest('.item');
        const itemId = itemDiv.dataset.item;
        const claimerInput = itemDiv.querySelector('.taken-by');
        const claimer = claimerInput.value.trim();
        const email = e.target.value.trim();
        
        if (claimer && email) {
          const checkbox = itemDiv.querySelector('input[type="checkbox"]');
          checkbox.checked = true;
          await claimItem(itemId, claimer, email);
        }
      });
    });

    // Load initial claims
    await loadClaims();
    
    // Periodically refresh claims
    setInterval(loadClaims, CONFIG.refreshInterval);
    
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

function createItemHTML(itemId, itemName, itemUrl, item) {
  return `
    <div class="item" data-item="${itemId}">
      <input type="checkbox" id="${itemId}">
      <div class="item-details">
        <label for="${itemId}">
          <div class="product-name">${itemName}</div>
          ${item.productZH ? `<div class="product-name-zh">${item.productZH}</div>` : ''}
          ${item.price ? `<div class="price">$${item.price}</div>` : ''}
        </label>
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${itemName}" class="item-image">` : ''}
        <div class="item-links">
          ${itemUrl ? `<a href="${itemUrl}" target="_blank" rel="noopener noreferrer">${MESSAGES.labels.productLink}</a>` : ''}
        </div>
      </div>
      <input type="text" class="taken-by" value="" placeholder="${MESSAGES.placeholders.takenBy}">
      <input type="email" class="claimer-email" value="" placeholder="${MESSAGES.placeholders.email}">
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