/**
 * Image Optimization Utilities
 * 
 * This module provides functionality for optimizing images:
 * - Lazy loading for images below the fold
 * - Fallback handling for images that fail to load
 */

import { DEBUG_MODE } from './constants.js';

// Default fallback image for products
export const DEFAULT_FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' text-anchor='middle' dominant-baseline='middle' fill='%23999'%3EImage%3C/text%3E%3C/svg%3E";

/**
 * Handles the load event for optimized images
 * This is also exposed globally for inline onload attributes
 */
export function handleOptimizedImageLoad(img) {
    if (img.src !== img.getAttribute('data-fallback')) {
        img.classList.remove('lazy-image');
        const placeholder = img.parentNode.querySelector('.placeholder-image');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }
}

// Explicitly attach handleOptimizedImageLoad to window for inline attribute usage
if (typeof window !== 'undefined') {
    window.handleOptimizedImageLoad = handleOptimizedImageLoad;
}

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
        onload="handleOptimizedImageLoad(this)"
    >`;
}

/**
 * Handles image load event for lazy-loaded images
 * @param {HTMLImageElement} image - The image element that loaded
 */
function handleImageLoad(image) {
    // Use the same function we export for inline attributes
    handleOptimizedImageLoad(image);
}

/**
 * Handles image error event for lazy-loaded images
 * @param {HTMLImageElement} image - The image element that failed to load
 * @param {string} fallbackSrc - The fallback source to use
 */
function handleImageError(image, fallbackSrc) {
    // Failed to load - use fallback
    if (DEBUG_MODE) {
        console.log('Image failed to load, using fallback', image.dataset.src);
    }
    image.onerror = null; // Prevent infinite loop
    image.src = fallbackSrc;
    image.classList.remove('lazy-image');
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
                            handleImageLoad(this);
                        };
                        
                        lazyImage.onerror = function() {
                            handleImageError(this, fallbackSrc);
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
                
                // Add onload handler before changing src
                img.onload = function() {
                    handleImageLoad(this);
                };
                
                // Add error handler before changing src
                img.onerror = function() {
                    handleImageError(this, fallbackSrc);
                };
                
                img.src = img.dataset.src;
            }
        });
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