import { ClaimText } from './types.js';
import { showClaimSuccessModal } from './modal.js';
import { sanitizeInput } from './util.js';
import { createOptimizedImage } from './imageOptimizer.js';
import { CONFIG } from './constants.js';

// ItemManager module to encapsulate all item-related functionality
const ItemManager = {
    // Send API request to claim an item with version for race condition prevention
    claimItem: async function(itemId, claimer, version) {
        try {
            const response = await fetch(`${CONFIG.api.endpoints.items}/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: itemId,
                    takenBy: claimer,
                    version: version
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                
                // Handle specific error types from the backend
                if (response.status === 400) {
                    throw new Error(errorData.error || 'Version is required for claim operations');
                } else if (response.status === 409) {
                    // Version conflict or item already claimed
                    const error = new Error(errorData.error || 'Item was modified since last view');
                    error.isVersionConflict = true;
                    error.currentVersion = errorData.currentVersion;
                    error.currentTakenBy = errorData.currentTakenBy;
                    throw error;
                } else {
                    throw new Error(errorData.error || 'Failed to claim item');
                }
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error claiming item:', error);
            
            // Don't show alert for version conflicts - we'll handle them specially
            if (!error.isVersionConflict) {
                alert('Failed to claim item. Please try again.');
            }
            throw error;
        }
    },

    // Get current item data from the global items cache
    getCurrentItemData: function(itemId) {
        try {
            const cachedItems = localStorage.getItem('cachedItems');
            if (cachedItems) {
                const items = JSON.parse(cachedItems);
                return items.find(item => item.id === itemId);
            }
        } catch (error) {
            console.error('Error getting current item data:', error);
        }
        return null;
    },

    // Refresh item data from server by fetching all items and finding the specific one
    refreshItemData: async function(itemId) {
        try {
            const response = await fetch(CONFIG.api.endpoints.items, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error('Failed to refresh item data');
            }
            
            const allItems = await response.json();
            const item = allItems.find(item => item.id === itemId);
            
            if (!item) {
                throw new Error('Item not found');
            }
            
            return item;
        } catch (error) {
            console.error('Error refreshing item data:', error);
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
            this.attachClaimListeners(itemElement, item);
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
    attachClaimListeners: function(itemElement, item) {
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

                        // Get current item data to ensure we have the latest version
                        let currentItem = this.getCurrentItemData(item.id) || item;
                        
                        // Sanitize input before sending to server
                        const sanitizedClaimer = sanitizeInput(claimer);
                        await this.claimItem(item.id, sanitizedClaimer, currentItem.version);
                        
                        // Update save button state to claimed
                        this.updateSaveButtonState(saveButton, nameInput, true);

                        // Show success modal using the imported function
                        showClaimSuccessModal();
                        // Update item status using the new function
                        this.updateItemStatus(itemElement, true);
                    } catch (error) {
                        if (error.isVersionConflict) {
                            // Handle version conflict
                            await this.handleVersionConflict(itemElement, item, error);
                        } else {
                            // Reset save button state on other errors
                            this.updateSaveButtonState(saveButton, nameInput);
                        }
                    }
                }
            });

            // Initial state check
            this.updateSaveButtonState(saveButton, nameInput);
        }
    },

    // Handle version conflicts by refreshing item data and updating UI
    handleVersionConflict: async function(itemElement, item, error) {
        try {
            // Show user-friendly message about the conflict
            const message = error.currentTakenBy 
                ? `This item was just claimed by ${error.currentTakenBy}. The page will be updated to show the current status.`
                : 'This item was just updated by someone else. The page will be updated to show the current status.';
            
            alert(message);
            
            // Try to refresh the item data
            const refreshedItem = await this.refreshItemData(item.id);
            
            // Update the UI with the refreshed data
            this.updateSingleItemUI(itemElement, refreshedItem);
            
            // Update the cached items in localStorage
            this.updateCachedItem(refreshedItem);
            
        } catch (refreshError) {
            console.error('Error handling version conflict:', refreshError);
            alert('Unable to refresh item data. Please reload the page to see the current status.');
        }
    },

    // Update a single item in the cached items array
    updateCachedItem: function(updatedItem) {
        try {
            const cachedItems = localStorage.getItem('cachedItems');
            if (cachedItems) {
                const items = JSON.parse(cachedItems);
                const itemIndex = items.findIndex(item => item.id === updatedItem.id);
                if (itemIndex !== -1) {
                    items[itemIndex] = updatedItem;
                    localStorage.setItem('cachedItems', JSON.stringify(items));
                }
            }
        } catch (error) {
            console.error('Error updating cached item:', error);
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
    },

    // Test function for race conditions (only available in development)
    testRaceCondition: async function(itemId, numConcurrentRequests = 3) {
        if (typeof window === 'undefined' || window.location.hostname !== 'localhost') {
            console.log('Race condition testing only available in local development');
            return;
        }

        console.log(`🧪 Testing race condition with ${numConcurrentRequests} concurrent requests for item ${itemId}`);
        
        // Get current item data
        const currentItem = this.getCurrentItemData(itemId);
        if (!currentItem) {
            console.error('❌ Item not found in cache');
            return;
        }

        if (currentItem.takenBy) {
            console.log('⚠️ Item is already claimed. Unclaim it first to test race conditions.');
            return;
        }

        console.log(`📊 Current item version: ${currentItem.version}`);

        // Create multiple concurrent claim requests
        const promises = [];
        for (let i = 0; i < numConcurrentRequests; i++) {
            const claimer = `TestUser${i + 1}`;
            console.log(`🚀 Starting request ${i + 1} with claimer: ${claimer}`);
            
            promises.push(
                this.claimItem(itemId, claimer, currentItem.version)
                    .then(result => ({
                        success: true,
                        claimer: claimer,
                        result: result
                    }))
                    .catch(error => ({
                        success: false,
                        claimer: claimer,
                        error: error.message,
                        isVersionConflict: error.isVersionConflict
                    }))
            );
        }

        // Wait for all requests to complete
        console.log('⏳ Waiting for all requests to complete...');
        const results = await Promise.all(promises);

        // Analyze results
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const versionConflicts = failed.filter(r => r.isVersionConflict);

        console.log('\n📋 Test Results:');
        console.log(`✅ Successful claims: ${successful.length}`);
        console.log(`❌ Failed claims: ${failed.length}`);
        console.log(`🔒 Version conflicts: ${versionConflicts.length}`);

        if (successful.length > 0) {
            console.log(`🎉 Winner: ${successful[0].claimer}`);
        }

        if (successful.length > 1) {
            console.error('🚨 RACE CONDITION DETECTED: Multiple successful claims!');
        } else if (successful.length === 1 && versionConflicts.length === numConcurrentRequests - 1) {
            console.log('✅ Race condition prevention working correctly!');
        }

        // Log detailed results
        results.forEach((result, index) => {
            if (result.success) {
                console.log(`✅ Request ${index + 1} (${result.claimer}): SUCCESS`);
            } else {
                console.log(`❌ Request ${index + 1} (${result.claimer}): FAILED - ${result.error}`);
            }
        });

        return results;
    }
};

export default ItemManager;
