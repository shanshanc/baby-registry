//# allFunctionsCalledOnLoad

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

// Cache WebP support detection for the session
export let webpSupported = null;

/**
 * Detect WebP support using canvas (synchronous)
 * Cached for the session to avoid repeated detection
 * @returns {boolean} True if WebP is supported, false otherwise
 */
export function supportsWebP() {
    if (webpSupported !== null) {
        return webpSupported;
    }
    
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) {
        webpSupported = false;
        if (DEBUG_MODE) {
            console.warn('WebP detection failed:', e);
        }
    }
    
    return webpSupported;
}

/**
 * Handles the load event for optimized images
 * This is also exposed globally for inline onload attributes
 */
export function handleOptimizedImageLoad(img) {
    if (img.src !== img.getAttribute('data-fallback')) {
        img.classList.remove('lazy-image');
    }
}

/**
 * Enhanced image error handler that implements the fallback chain:
 * WebP → original image → default fallback
 * @param {HTMLImageElement} img - The image element that failed to load
 */
function handleImageErrorWithFallback(img) {
    if (DEBUG_MODE) {
        console.log('Image failed to load:', img.src);
    }
    
    // Prevent infinite loop
    img.onerror = null;
    
    // Check if we have fallback URLs to try
    const originalSrc = img.getAttribute('data-original-src');
    const webpSrc = img.getAttribute('data-webp-src');
    const fallbackSrc = img.getAttribute('data-fallback');
    
    // If we're currently showing WebP and have an original image, try that
    if (img.src === webpSrc && originalSrc) {
        if (DEBUG_MODE) {
            console.log('WebP failed, trying original image:', originalSrc);
        }
        img.onerror = () => handleImageErrorWithFallback(img);
        img.src = originalSrc;
        return;
    }
    
    // If we're showing original image (or direct original), use final fallback
    if (DEBUG_MODE) {
        console.log('Using default fallback for image');
    }
    img.src = fallbackSrc || DEFAULT_FALLBACK_IMAGE;
}

/**
 * Creates a lazy-loaded image element with WebP support and fallback chain
 * - createOptimizedImage(originalSrc, webpSrc, options)
 * 
 * @param {string} originalSrc - The image source URL
 * @param {string} webpSrc - The WebP version of the image source URL
 * @param {string} alt - Alt text for the image, default to product name
 * @returns {string} HTML string for the optimized image
 */
export function createOptimizedImage(
  originalSrc,
  webpSrc,
  options = {}
) {    
    const { alt } = options;
    
    // Validate URLs and determine which to use
    const originalValid = isValidImageUrl(originalSrc);
    const webpValid = isValidImageUrl(webpSrc);
    
    // Choose primary source based on WebP support and URL validity
    let primarySrc;
    let fallbackSrc;
    
    if (webpSupported && webpValid) {
        primarySrc = webpSrc;
        fallbackSrc = originalValid ? originalSrc : DEFAULT_FALLBACK_IMAGE;
    } else if (originalValid) {
        primarySrc = originalSrc;
        fallbackSrc = DEFAULT_FALLBACK_IMAGE;
    } else {
        // Neither URL is valid, use placeholder
        primarySrc = DEFAULT_FALLBACK_IMAGE;
        fallbackSrc = DEFAULT_FALLBACK_IMAGE;
    }
    
    // Build data attributes for fallback chain
    const dataAttributes = [
        `data-src="${primarySrc}"`,
        `data-fallback="${fallbackSrc}"`
    ];
    
    // Add WebP fallback info if using WebP
    if (webpSupported && webpValid && originalValid) {
        dataAttributes.push(`data-webp-src="${webpSrc}"`);
        dataAttributes.push(`data-original-src="${originalSrc}"`);
    }
    
    const shouldLazyLoad = primarySrc !== DEFAULT_FALLBACK_IMAGE;
    
    return `<img 
        src="${primarySrc}" 
        ${dataAttributes.join(' ')}
        alt="${alt || 'Product image'}" 
        class="item-image ${shouldLazyLoad ? 'lazy-image' : ''}" 
        loading="lazy" 
        onerror="handleImageErrorWithFallback(this)"
        onload="handleOptimizedImageLoad(this)"
    >`;
}

/**
 * Helper function to validate image URLs
 * @param {string} src - The image source URL
 * @returns {boolean} True if the URL is valid, false otherwise
 */
function isValidImageUrl(src) {
    return src && (isHttpImage(src) || isDataImage(src)) && !src.includes('undefined') && !src.includes('null');
}

/**
 * Handles image error event for lazy-loaded images (legacy function, kept for compatibility)
 * @param {HTMLImageElement} image - The image element that failed to load
 * @param {string} fallbackSrc - The fallback source to use
 */
function handleImageError(img, fallbackSrc = DEFAULT_FALLBACK_IMAGE) {
    if (DEBUG_MODE) {
        console.log('Image failed to load, using fallback', img.dataset.src);
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

// --- Expose functions to global scope for inline HTML attributes ---
if (typeof window !== 'undefined') {
    window.handleOptimizedImageLoad = handleOptimizedImageLoad;
    window.handleImageError = handleImageError;
    window.handleImageErrorWithFallback = handleImageErrorWithFallback;
    
    // Expose testing functions in debug mode
    if (DEBUG_MODE) {
        window.testWebPSupport = testWebPSupport;
    }
}

/**
 * Test function to check WebP support - useful for debugging
 * @returns {object} Object containing WebP support status and details
 */
export function testWebPSupport() {
    const support = supportsWebP();
    const details = {
        supported: support,
        cached: webpSupported !== null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
    };
    
    if (DEBUG_MODE) {
        console.log('WebP Support Test:', details);
    }
    
    return details;
} 

/**
 * Test-only helper to manually set the WebP support state.
 * @param {boolean|null} value - The value to set for WebP support.
 */
export function __test_only_setWebpSupported(value) {
    webpSupported = value;
} 