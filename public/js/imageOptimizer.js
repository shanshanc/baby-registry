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
    // Try to detect invalid URLs early and use fallback
    const validUrl = src && (isHttpImage(src) || isDataImage(src)) && !src.includes('undefined') && !src.includes('null');
    const finalSrc = validUrl ? src : fallbackSrc;
    
    return `<img 
        src="${finalSrc}" 
        data-src="${validUrl ? src : ''}" 
        data-fallback="${fallbackSrc}"
        alt="${alt || 'Product image'}" 
        class="${className} ${validUrl ? 'lazy-image' : ''}" 
        loading="lazy" 
        onerror="handleImageError(this)"
        onload="handleOptimizedImageLoad(this)"
    >`;
}

/**
 * Handles image error event for lazy-loaded images
 * @param {HTMLImageElement} image - The image element that failed to load
 * @param {string} fallbackSrc - The fallback source to use
 */
function handleImageError(img, fallbackSrc = DEFAULT_FALLBACK_IMAGE) {
    if (DEBUG_MODE) {
        console.log('Image failed to load, using fallback', image.dataset.src);
    }
    // Prevent infinite loop
    img.onerror = null;
    img.src = fallbackSrc;
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
                        // For cross-origin images, add crossorigin attribute
                        try {
                            const imageUrl = new URL(lazyImage.dataset.src);
                            if (imageUrl.origin !== window.location.origin) {
                                lazyImage.crossOrigin = "anonymous";
                            }
                        } catch (e) {
                            // Invalid URL, will fallback
                            if (DEBUG_MODE) {
                                console.warn('Invalid image URL:', lazyImage.dataset.src);
                            }
                        }
                        
                        // Set the actual source - onload/onerror handlers are already defined as HTML attributes
                        lazyImage.src = lazyImage.dataset.src;
                    }
                    
                    // Stop observing this image
                    observer.unobserve(lazyImage);
                }
            });
        });

        // Observe all images with lazy-image class
        document.querySelectorAll('img.lazy-image').forEach(img => {
            // Skip images that already have their final src
            if (img.dataset.src && img.src !== img.dataset.src) {
                imageObserver.observe(img);
            }
        });
    } else {
        // Fallback for browsers that don't support Intersection Observer
        document.querySelectorAll('img.lazy-image').forEach(img => {
            if (img.dataset.src && img.src !== img.dataset.src) {
                // For cross-origin images, add crossorigin attribute
                try {
                    const imageUrl = new URL(img.dataset.src);
                    if (imageUrl.origin !== window.location.origin) {
                        img.crossOrigin = "anonymous";
                    }
                } catch (e) {
                    // Invalid URL, will fallback
                }
                
                // Set the actual source - onload/onerror handlers are already defined as HTML attributes
                img.src = img.dataset.src;
            }
        });
    }
}

/**
 * Helper function to check if the image source is a data URL
 * @param {string} src - The image source URL
 * @returns {boolean} True if the source is a data URL, false otherwise
 */
export function isDataImage(src) {
  return typeof src === 'string' && src.startsWith('data:image/');
}

/**
 * Helper function to check if the image source is an HTTP URL
 * @param {string} src - The image source URL
 * @returns {boolean} True if the source is an HTTP URL, false otherwise
 */
export function isHttpImage(src) {
  return typeof src === 'string' && src.match(/^https?:\/\//);
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