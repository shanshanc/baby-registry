/**
 * Image Optimization Utilities
 * 
 * This module provides functionality for optimizing images:
 * - Lazy loading for images below the fold
 * - Fallback handling for images that fail to load
 */

import { DEBUG_MODE } from './constants.js';

// Default fallback image for products
const DEFAULT_FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' text-anchor='middle' dominant-baseline='middle' fill='%23999'%3EImage%3C/text%3E%3C/svg%3E";

/**
 * Creates a lazy-loaded image element with fallback support
 * @param {string} src - The image source URL
 * @param {string} alt - Alt text for the image
 * @param {string} className - CSS class for the image element
 * @param {string} fallbackSrc - Optional fallback image source
 * @returns {string} HTML string for the optimized image
 */
export function createOptimizedImage(src, alt, className, fallbackSrc = DEFAULT_FALLBACK_IMAGE) {
    // Add inline style for immediate placeholder appearance
    const placeholderStyle = `
        background-color: #f0f0f0;
        display: block;
    `;
    
    return `<img 
        src="${fallbackSrc}" 
        data-src="${src}" 
        data-fallback="${fallbackSrc}"
        alt="${alt}" 
        class="${className} lazy-image" 
        style="${placeholderStyle}"
        loading="lazy" 
        onerror="this.onerror=null; this.src=this.getAttribute('data-fallback');"
    >`;
}

/**
 * Initialize lazy loading for images on the page
 */
export function initLazyLoading() {
    // Use Intersection Observer API to detect when images enter viewport
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const lazyImage = entry.target;
                    
                    // Replace data-src with actual src attribute
                    if (lazyImage.dataset.src) {
                        // Store fallback for error handling
                        const fallbackSrc = lazyImage.src;
                        
                        // Add onload and onerror handlers before changing src
                        lazyImage.onload = function() {
                            // Successfully loaded - remove lazy-image class to apply transitions
                            lazyImage.classList.remove('lazy-image');
                        };
                        
                        lazyImage.onerror = function() {
                            // Failed to load - use fallback
                            console.log('Image failed to load, using fallback', lazyImage.dataset.src);
                            this.onerror = null; // Prevent infinite loop
                            this.src = fallbackSrc;
                            lazyImage.classList.remove('lazy-image');
                        };
                        
                        // Set the actual source
                        lazyImage.src = lazyImage.dataset.src;
                    }
                    
                    // Stop observing this image
                    observer.unobserve(lazyImage);
                }
            });
        });

        // Observe all images with lazy-image class
        document.querySelectorAll('img.lazy-image').forEach(img => {
            imageObserver.observe(img);
        });
    } else {
        // Fallback for browsers that don't support Intersection Observer
        document.querySelectorAll('img.lazy-image').forEach(img => {
            if (img.dataset.src) {
                // Store fallback for error handling
                const fallbackSrc = img.src;
                
                // Add error handler before changing src
                img.onerror = function() {
                    console.log('Image failed to load in fallback mode, using fallback', img.dataset.src);
                    this.onerror = null;
                    this.src = fallbackSrc;
                    img.classList.remove('lazy-image');
                };
                
                img.src = img.dataset.src;
            }
            img.classList.remove('lazy-image');
        });
    }
}

/**
 * Add CSS styles for lazy images
 */
export function addLazyImageStyles() {
    // Add these styles only if they don't already exist
    if (!document.getElementById('lazy-image-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'lazy-image-styles';
        styleElement.textContent = `
            .lazy-image {
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
            }
            
            img:not(.lazy-image) {
                opacity: 1;
            }
        `;
        document.head.appendChild(styleElement);
    }
}

/**
 * Manually trigger fallbacks for all images - useful for testing
 */
export function testFallbacks() {
    document.querySelectorAll('img.lazy-image, img[data-fallback]').forEach(img => {
        // Force image to use fallback
        img.src = img.getAttribute('data-fallback') || DEFAULT_FALLBACK_IMAGE;
        // Remove lazy-image class to make it visible
        img.classList.remove('lazy-image');
        if (DEBUG_MODE) {
            console.log('Fallback applied to:', img);
        }
    });
    if (DEBUG_MODE) {
        console.log('Fallbacks applied to all images');
    }
}

// If the global debug function placeholder exists and we're in debug mode, 
// replace it with the real implementation
if (DEBUG_MODE && typeof window !== 'undefined' && typeof window.testImageFallbacks === 'function') {
    window.testImageFallbacks = testFallbacks;
} 