// Initialize modal event listeners
export function initModal() {
    const closeButton = document.getElementById('close-modal');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            const modal = document.getElementById('claim-success-modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    }
}

// Function to show the modal
export function showClaimSuccessModal() {
    console.log('showClaimSuccessModal');
    const modal = document.getElementById('claim-success-modal');
    if (modal) {
        modal.classList.add('active');
    } else {
        console.error('Modal element not found');
    }
} 