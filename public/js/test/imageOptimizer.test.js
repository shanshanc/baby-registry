import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDataImage, isHttpImage, handleOptimizedImageLoad, createOptimizedImage, DEFAULT_FALLBACK_IMAGE, initLazyLoading } from '../imageOptimizer.js';

describe('isDataImage', () => {
  it('should return true for valid data URLs', () => {
    expect(isDataImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')).toBe(true);
    expect(isDataImage('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe(true);
    expect(isDataImage('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(true);
  });

  it('should return false for invalid data URLs', () => {
    expect(isDataImage('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==')).toBe(false); // Not an image
    expect(isDataImage('data:imagepng;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')).toBe(false); // Missing slash
    expect(isDataImage('data:;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')).toBe(false); // Missing image type
  });

  it('should return false for non-data URLs', () => {
    expect(isDataImage('http://example.com/image.png')).toBe(false);
    expect(isDataImage('https://example.com/image.jpg')).toBe(false);
    expect(isDataImage('/local/path/image.gif')).toBe(false);
    expect(isDataImage('image.bmp')).toBe(false);
    expect(isDataImage('')).toBe(false);
    expect(isDataImage(null)).toBe(false);
    expect(isDataImage(undefined)).toBe(false);
  });
});

describe('isHttpImage', () => {
  it('should return true for valid HTTP/HTTPS URLs', () => {
    expect(isHttpImage('http://example.com/image.png')).toBeTruthy();
    expect(isHttpImage('https://example.com/image.jpg')).toBeTruthy();
    expect(isHttpImage('http://localhost:3000/test.gif')).toBeTruthy();
  });

  it('should return false for invalid or non-HTTP/HTTPS URLs', () => {
    expect(isHttpImage('ftp://example.com/image.png')).toBeFalsy();
    expect(isHttpImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')).toBeFalsy();
    expect(isHttpImage('/local/path/image.gif')).toBeFalsy();
    expect(isHttpImage('image.bmp')).toBeFalsy();
    expect(isHttpImage('')).toBeFalsy();
    expect(isHttpImage(null)).toBeFalsy();
    expect(isHttpImage(undefined)).toBeFalsy();
    expect(isHttpImage('http:/example.com/image.png')).toBeFalsy(); // Missing slash
    expect(isHttpImage('https//example.com/image.jpg')).toBeFalsy(); // Missing colon
  });
});

describe('handleOptimizedImageLoad', () => {
  let mockImg;

  beforeEach(() => {
    // Create a mock image element before each test
    mockImg = document.createElement('img');
    mockImg.classList.add('lazy-image');
  });

  it('should remove lazy-image class if src is different from data-fallback', () => {
    mockImg.src = 'path/to/image.jpg';
    mockImg.setAttribute('data-fallback', 'path/to/fallback.jpg');
    handleOptimizedImageLoad(mockImg);
    expect(mockImg.classList.contains('lazy-image')).toBe(false);
  });

  it('should not remove lazy-image class if src is the same as data-fallback', () => {
    mockImg.src = DEFAULT_FALLBACK_IMAGE;
    mockImg.setAttribute('data-fallback', DEFAULT_FALLBACK_IMAGE);
    handleOptimizedImageLoad(mockImg);
    expect(mockImg.classList.contains('lazy-image')).toBe(true);
  });

  it('should handle cases where data-fallback attribute is not present', () => {
    mockImg.src = 'path/to/image.jpg';
    handleOptimizedImageLoad(mockImg);
    expect(mockImg.classList.contains('lazy-image')).toBe(false);
  });
});

describe('createOptimizedImage', () => {
  const testSrc = 'http://example.com/image.png';
  const testAlt = 'Test Image';
  const testClass = 'custom-image-class';
  const customFallback = 'http://example.com/custom-fallback.png';

  // Helper to parse the HTML string and get the element
  const parseImgString = (htmlString) => {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
  };

  it('should create an image with correct src, alt, and class for valid URL', () => {
    const imgHtml = createOptimizedImage(testSrc, testAlt, testClass);
    const imgElement = parseImgString(imgHtml);

    expect(imgElement.tagName).toBe('IMG');
    expect(imgElement.src).toBe(testSrc);
    expect(imgElement.getAttribute('data-src')).toBe(testSrc);
    expect(imgElement.getAttribute('alt')).toBe(testAlt);
    expect(imgElement.classList.contains(testClass)).toBe(true);
    expect(imgElement.classList.contains('lazy-image')).toBe(true);
    expect(imgElement.getAttribute('loading')).toBe('lazy');
    expect(imgElement.getAttribute('onerror')).toBe('handleImageError(this)');
    expect(imgElement.getAttribute('onload')).toBe('handleOptimizedImageLoad(this)');
    expect(imgElement.getAttribute('data-fallback')).toBe(DEFAULT_FALLBACK_IMAGE);
  });

  it('should use default fallback for invalid src URL', () => {
    const invalidSrc = 'htp:/invalid-url';
    const imgHtml = createOptimizedImage(invalidSrc, testAlt, testClass);
    const imgElement = parseImgString(imgHtml);

    expect(imgElement.src).toBe(DEFAULT_FALLBACK_IMAGE);
    expect(imgElement.getAttribute('data-src')).toBe(''); // data-src should be empty for invalid
    expect(imgElement.classList.contains('lazy-image')).toBe(false);
    expect(imgElement.getAttribute('data-fallback')).toBe(DEFAULT_FALLBACK_IMAGE);
  });

  it('should use provided fallbackSrc when src is invalid', () => {
    const invalidSrc = null;
    const imgHtml = createOptimizedImage(invalidSrc, testAlt, testClass, customFallback);
    const imgElement = parseImgString(imgHtml);

    expect(imgElement.src).toBe(customFallback);
    expect(imgElement.getAttribute('data-src')).toBe('');
    expect(imgElement.getAttribute('data-fallback')).toBe(customFallback);
    expect(imgElement.classList.contains('lazy-image')).toBe(false);
  });

  it('should use default alt text if alt is not provided', () => {
    const imgHtml = createOptimizedImage(testSrc, null, testClass);
    const imgElement = parseImgString(imgHtml);
    expect(imgElement.getAttribute('alt')).toBe('Product image');
  });

  it('should handle src containing \'undefined\' or \'null\' strings as invalid', () => {
    const srcWithUndefined = 'http://example.com/image_undefined.png';
    const imgHtmlUndefined = createOptimizedImage(srcWithUndefined, testAlt, testClass);
    const imgElementUndefined = parseImgString(imgHtmlUndefined);
    expect(imgElementUndefined.src).toBe(DEFAULT_FALLBACK_IMAGE);

    const srcWithNull = 'http://example.com/image_null.jpg';
    const imgHtmlNull = createOptimizedImage(srcWithNull, testAlt, testClass);
    const imgElementNull = parseImgString(imgHtmlNull);
    expect(imgElementNull.src).toBe(DEFAULT_FALLBACK_IMAGE);
  });

   it('should correctly set attributes for a valid data URL', () => {
    const dataSrc = DEFAULT_FALLBACK_IMAGE; // Using it as a valid data URL
    const imgHtml = createOptimizedImage(dataSrc, testAlt, testClass);
    const imgElement = parseImgString(imgHtml);

    expect(imgElement.src).toBe(dataSrc);
    expect(imgElement.getAttribute('data-src')).toBe(dataSrc);
    expect(imgElement.classList.contains('lazy-image')).toBe(true);
  });
});

describe('initLazyLoading', () => {
  let mockObserve = vi.fn();
  let mockUnobserve = vi.fn();
  let mockDisconnect = vi.fn();
  let intersectionCallback = null;

  const mockIntersectionObserver = vi.fn((callback, options) => {
    intersectionCallback = callback; // Store the callback
    return {
      observe: mockObserve,
      unobserve: mockUnobserve,
      disconnect: mockDisconnect,
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: vi.fn(() => [])
    };
  });

  beforeEach(() => {
    // Reset mocks and saved callback before each test
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
    intersectionCallback = null;
    
    // Mock window.IntersectionObserver
    vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

    // Clear and set up mock images in the document body for each test
    document.body.innerHTML = ''; 
  });

  afterEach(() => {
    // Restore the original IntersectionObserver (Vitest does this automatically for stubGlobal)
    vi.restoreAllMocks(); // Ensures all mocks are restored
  });

  it('should create an IntersectionObserver and observe images with lazy-image class', () => {
    // Arrange: Add a mock image to the document
    document.body.innerHTML = '<img class="lazy-image" data-src="test.jpg" src="placeholder.jpg">';
    const img = document.querySelector('.lazy-image');

    // Act: Call the function
    initLazyLoading();

    // Assert: Check if IntersectionObserver constructor was called
    expect(mockIntersectionObserver).toHaveBeenCalled();
    // Assert: Check if observe was called on the image
    expect(mockObserve).toHaveBeenCalledWith(img);
  });

  it('should set src from data-src and unobserve when an image intersects', () => {
    // Arrange: Add a mock image
    const originalSrc = 'placeholder.jpg';
    const newSrc = 'test.jpg';
    document.body.innerHTML = `<img class="lazy-image" data-src="${newSrc}" src="${originalSrc}">`;
    const img = document.querySelector('.lazy-image');

    initLazyLoading(); // This sets up the observer and stores the callback

    // Act: Simulate IntersectionObserver callback
    expect(intersectionCallback).toBeInstanceOf(Function);

    const mockEntry = { isIntersecting: true, target: img };
    // This is the mock instance that the callback expects, containing .unobserve()
    const mockObserverInstance = mockIntersectionObserver.mock.results[0].value;
    intersectionCallback([mockEntry], mockObserverInstance);

    // Assert: Image src should be updated
    expect(img.src).toContain(newSrc);
    // Assert: unobserve should have been called
    expect(mockUnobserve).toHaveBeenCalledWith(img);
  });

  it('should set crossOrigin to anonymous for cross-origin data-src URLs', () => {
    const crossOriginSrc = 'https://external-domain.com/image.jpg';
    document.body.innerHTML = `<img class="lazy-image" data-src="${crossOriginSrc}" src="placeholder.jpg">`;
    const img = document.querySelector('.lazy-image');

    initLazyLoading();
    expect(intersectionCallback).toBeInstanceOf(Function);

    const mockEntry = { isIntersecting: true, target: img };
    const mockObserverInstance = mockIntersectionObserver.mock.results[0].value;
    intersectionCallback([mockEntry], mockObserverInstance);

    expect(img.crossOrigin).toBe('anonymous');
    expect(img.src).toContain(crossOriginSrc);
    expect(mockUnobserve).toHaveBeenCalledWith(img);
  });

  it('should not set crossOrigin for same-origin data-src URLs', () => {
    // jsdom's default window.location.origin is 'http://localhost:3000' or similar
    // For this test, let's ensure data-src is treated as same-origin
    const sameOriginSrc = '/same-origin-image.jpg'; // Relative path is same-origin
    document.body.innerHTML = `<img class="lazy-image" data-src="${sameOriginSrc}" src="placeholder.jpg">`;
    const img = document.querySelector('.lazy-image');
    
    // To be absolutely sure about the origin for the test, we can mock window.location.origin if needed
    // or rely on jsdom's default and ensure sameOriginSrc is a relative path or matches the default.
    // For now, we assume /path will be treated as same-origin by new URL(img.dataset.src)

    initLazyLoading();
    expect(intersectionCallback).toBeInstanceOf(Function);

    const mockEntry = { isIntersecting: true, target: img };
    const mockObserverInstance = mockIntersectionObserver.mock.results[0].value;
    intersectionCallback([mockEntry], mockObserverInstance);

    expect(img.crossOrigin).toBeFalsy(); // or .toBe(null) or .toBe('') depending on browser/jsdom behavior for not set
    expect(img.src).toContain(sameOriginSrc);
    expect(mockUnobserve).toHaveBeenCalledWith(img);
  });

  describe('when IntersectionObserver is not supported', () => {
    let originalIntersectionObserver;

    beforeEach(() => {
      // Store original and remove IntersectionObserver from window
      originalIntersectionObserver = window.IntersectionObserver;
      delete window.IntersectionObserver;
      // Ensure our mock constructor is not used in these tests
      mockIntersectionObserver.mockClear(); 
    });

    afterEach(() => {
      // Restore IntersectionObserver
      window.IntersectionObserver = originalIntersectionObserver;
    });

    it('should directly set src from data-src for all lazy-images', () => {
      const imgSrc1 = 'test1.jpg';
      const imgSrc2 = 'https://external.com/test2.png';
      document.body.innerHTML = `
        <img class="lazy-image" data-src="${imgSrc1}" src="placeholder1.jpg">
        <img class="lazy-image" data-src="${imgSrc2}" src="placeholder2.jpg">
        <img class="not-lazy" src="placeholder3.jpg">
      `;
      const img1 = document.querySelectorAll('.lazy-image')[0];
      const img2 = document.querySelectorAll('.lazy-image')[1];

      initLazyLoading();

      expect(img1.src).toContain(imgSrc1);
      expect(img2.src).toContain(imgSrc2);
      // Ensure crossOrigin is set for cross-origin images even in fallback
      expect(img2.crossOrigin).toBe('anonymous'); 
      // Ensure our mock observer was NOT called
      expect(mockIntersectionObserver).not.toHaveBeenCalled();
    });

    it('should not attempt to observe images if IntersectionObserver is not available', () => {
      document.body.innerHTML = '<img class="lazy-image" data-src="test.jpg" src="placeholder.jpg">';
      initLazyLoading();
      expect(mockIntersectionObserver).not.toHaveBeenCalled();
      expect(mockObserve).not.toHaveBeenCalled(); // Double check observe was not called
    });
  });
});
