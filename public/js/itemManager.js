import { ClaimText } from './types.js';
import { showClaimSuccessModal } from './modal.js';
import { sanitizeInput } from './util.js';
import { createOptimizedImage } from './imageOptimizer.js';
import { CONFIG } from './constants.js';

// ItemManager module to encapsulate all item-related functionality
const ItemManager = {
    // Send API request to claim an item
    claimItem: async function(itemId, claimer) {
        try {
            const response = await fetch(`${CONFIG.api.endpoints.items}/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: itemId,
                    takenBy: claimer
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to claim item');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error claiming item:', error);
            alert('Failed to claim item. Please try again.');
            throw error;
        }
    },
    
    // Update the status display of an item
    updateItemStatus: function(itemElement, isTaken=true) {
        const itemStatus = itemElement.querySelector('.product-status');
        if (itemStatus) {
            // Remove all status classes
            itemStatus.classList.remove('available', 'taken');
            // Add the new status class and update text content
            itemStatus.classList.add(isTaken ? 'taken' : 'available');
            itemStatus.textContent = isTaken ? ClaimText.TAKEN : ClaimText.AVAILABLE;
        }
    },
    
    // Update claim fields section of an item
    updateItemClaimFields: function(itemElement, item) {
        const claimFields = itemElement.querySelector('.claim-fields');
        if (!claimFields) return;
        
        if (item.takenBy) {
            // Item is claimed - update to show claimed state
            claimFields.innerHTML = `
                <input type="text" class="claimer-name" value="${sanitizeInput(item.takenBy)}" readonly="true">
                <span class="claimed-badge">${ClaimText.CLAIMED}</span>
            `;
        } else {
            // Item is available - update to show claim form
            claimFields.innerHTML = `
                <input type="text" class="taken-by" placeholder="您的大名 💕">
                <button class="save-button" disabled>${ClaimText.CLAIM}</button>
            `;
            // Reattach event listeners for the new elements
            this.attachClaimListeners(itemElement, item.id);
        }
    },
    
    // Update save button state
    updateSaveButtonState: function(saveButton, nameInput, isClaimed=false) {
        if (isClaimed) {
            saveButton.textContent = ClaimText.CLAIMED;
            saveButton.disabled = true;
            nameInput.disabled = true;
        } else {
            const nameValue = nameInput.value.trim();
            saveButton.textContent = ClaimText.CLAIM;
            saveButton.disabled = !nameValue;
            nameInput.disabled = false;
        }
    },
    
    // Attach event listeners to claim form elements
    attachClaimListeners: function(itemElement, itemId) {
        const saveButton = itemElement.querySelector('.save-button');
        if (saveButton) {
            const nameInput = itemElement.querySelector('.taken-by');
            
            // Update save button state based on input
            nameInput.addEventListener('input', () => {
                this.updateSaveButtonState(saveButton, nameInput);
            });
            
            saveButton.addEventListener('click', async () => {
                const claimer = nameInput.value.trim();
                if (claimer) {
                    try {
                        saveButton.textContent = ClaimText.SAVING;
                        saveButton.disabled = true;
                        nameInput.disabled = true;

                        // Sanitize input before sending to server
                        const sanitizedClaimer = sanitizeInput(claimer);
                        await this.claimItem(itemId, sanitizedClaimer);
                        
                        // Update save button state to claimed
                        this.updateSaveButtonState(saveButton, nameInput, true);

                        // Show success modal using the imported function
                        showClaimSuccessModal();
                        // Update item status using the new function
                        this.updateItemStatus(itemElement, true);
                    } catch (error) {
                        // Reset save button state on error
                        this.updateSaveButtonState(saveButton, nameInput);
                    }
                }
            });

            // Initial state check
            this.updateSaveButtonState(saveButton, nameInput);
        }
    },
    
    // Update a single item's UI based on its state
    updateSingleItemUI: function(itemElement, item) {
        // Find relevant item elements
        const nameInput = itemElement.querySelector('.claimer-name');
        
        // Check if taken status changed
        const currentTakenBy = nameInput ? nameInput.value : '';
        if (item.takenBy === currentTakenBy) {
            // Also check if image URL has changed
            const currentImage = itemElement.querySelector('.item-image');
            const currentImageSrc = currentImage ? currentImage.dataset.src : '';
            
            if (currentImageSrc === item.imageUrl) {
                return false; // No change needed
            }
            
            // If only the image changed, update just the image
            if (currentImage && item.imageUrl && currentImageSrc !== item.imageUrl) {
                const productName = item.product.toLowerCase().replace(/ /g, '-');
                const imageContainer = currentImage.parentElement;
                if (imageContainer) {
                    imageContainer.removeChild(currentImage);
                    imageContainer.insertAdjacentHTML('afterbegin', createOptimizedImage(
                      item.imageUrl,
                      item.imageUrlWebp,
                      {
                        alt: productName
                      }
                    ));
                    return true;
                }
            }
        }
        
        // Update item status display
        this.updateItemStatus(itemElement, item.takenBy);
        
        // Update claim fields
        this.updateItemClaimFields(itemElement, item);
        
        return true; // Item was updated
    }
};

export default ItemManager;
