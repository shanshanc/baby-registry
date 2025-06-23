// Unified Sidebar Functionality (MDN-style responsive design)
import { DEBUG_MODE } from './constants.js';

const sidebarState = {
    isOpen: false,
    isMobile: false
};

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarToggleMobile = document.getElementById('sidebar-toggle-mobile');
    const sidebarClose = document.getElementById('sidebar-close');

    if (!sidebar) {
        console.error('Sidebar element not found');
        return;
    }

    // Check if we're on mobile
    function updateMobileState() {
        const wasMobile = sidebarState.isMobile;
        sidebarState.isMobile = window.innerWidth <= 768;
        
        // If we switched from mobile to desktop or vice versa, reset sidebar state
        if (wasMobile !== sidebarState.isMobile) {
            if (!sidebarState.isMobile) {
                // Switching to desktop - ensure sidebar is visible
                closeSidebar();
            } else {
                // Switching to mobile - ensure sidebar is hidden
                closeSidebar();
            }
        }
    }

    // Open sidebar
    function openSidebar() {
        if (!sidebarState.isMobile) return; // Only for mobile
        
        sidebarState.isOpen = true;
        sidebar.classList.add('mobile-open');
        sidebarOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        if (DEBUG_MODE) {
            console.log('Sidebar opened');
        }
    }

    // Close sidebar
    function closeSidebar() {
        if (!sidebarState.isMobile) return; // Only for mobile
        
        sidebarState.isOpen = false;
        sidebar.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('visible');
        document.body.style.overflow = ''; // Restore scrolling
        
        if (DEBUG_MODE) {
            console.log('Sidebar closed');
        }
    }

    // Toggle sidebar
    function toggleSidebar() {
        if (sidebarState.isOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    // Event listeners
    if (sidebarToggleMobile) {
        sidebarToggleMobile.addEventListener('click', toggleSidebar);
    }
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (sidebarState.isMobile && sidebarState.isOpen) {
            if (!sidebar.contains(e.target) && 
                !sidebarToggleMobile?.contains(e.target)) {
                closeSidebar();
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', updateMobileState);

    // Close sidebar on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarState.isOpen) {
            closeSidebar();
        }
    });

    // Initialize state
    updateMobileState();

    if (DEBUG_MODE) {
        console.log('Unified sidebar initialized');
    }
}

// Simplified sticky header without mobile filter logic
function initStickyHeader() {
    const stickyHeader = document.getElementById('sticky-header');
    const container = document.querySelector('.container');
    
    if (!stickyHeader || !container) {
        console.error('Sticky header or container not found');
        return;
    }

    let heroHeight = 0;
    let isVisible = false;

    // Calculate hero section height
    function calculateHeroHeight() {
        const title = container.querySelector('.title');
        const bankAccount = container.querySelector('.bank-account');
        const address = container.querySelector('.address');
        const recipient = container.querySelector('.recipient');
        
        if (title) {
            const titleRect = title.getBoundingClientRect();
            
            // Mobile: Trigger after title
            if (window.innerWidth <= 768) {
                heroHeight = titleRect.bottom - titleRect.top;
            } 
            // Desktop: Trigger after full hero section
            else if (bankAccount && address && recipient) {
                const recipientRect = recipient.getBoundingClientRect();
                heroHeight = recipientRect.bottom - titleRect.top + 50;
            }
        }
    }

    // Handle scroll events
    function handleScroll() {
        const scrollY = window.scrollY;
        const isMobile = window.innerWidth <= 768;
        const shouldShow = isMobile || scrollY > heroHeight; // Always show on mobile
        
        if (shouldShow !== isVisible) {
            isVisible = shouldShow;
            stickyHeader.classList.toggle('visible', shouldShow);
            document.body.classList.toggle('sticky-header-active', shouldShow);
        }
    }

    // Handle navigation clicks
    function handleNavClick(event) {
        const target = event.currentTarget.dataset.target;
        
        if (window.innerWidth <= 768) {
            // Mobile: scroll to top
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            // Desktop: scroll to specific element
            const targetElement = document.getElementById(target);
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 20;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        }
    }

    // Update tooltip content
    function updateTooltipContent() {
        const navItems = document.querySelectorAll('.sticky-nav-item[data-tooltip]');
        navItems.forEach(item => {
            const target = item.dataset.target;
            const targetElement = document.getElementById(target);
            
            if (targetElement && item.dataset.tooltip.includes('查看')) {
                const content = targetElement.textContent?.trim();
                if (content && content !== '載入中...') {
                    item.dataset.tooltip = content;
                }
            }
        });
    }

    // Initialize
    calculateHeroHeight();
    updateTooltipContent();

    // Attach navigation handlers
    const navItems = document.querySelectorAll('.sticky-nav-item, .sticky-nav-item-mobile');
    navItems.forEach(item => {
        item.addEventListener('click', handleNavClick);
    });

    // Add event listeners
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', () => {
        calculateHeroHeight();
        // Immediately check sticky header state on resize (mobile/desktop switch)
        handleScroll();
    });

    // Initial check to show sticky header immediately on mobile
    setTimeout(() => {
        handleScroll();
    }, 100);

    // Check for data updates periodically
    const tooltipUpdateInterval = setInterval(() => {
        updateTooltipContent();
        
        const bankLoaded = document.getElementById('bank-account')?.textContent !== '載入中...';
        const addressLoaded = document.getElementById('shipping-address')?.textContent !== '載入中...';
        const recipientLoaded = document.getElementById('recipient')?.textContent !== '載入中...';
        
        if (bankLoaded && addressLoaded && recipientLoaded) {
            clearInterval(tooltipUpdateInterval);
        }
    }, 500);

    if (DEBUG_MODE) {
        console.log('Simplified sticky header initialized');
    }
}

export { initSidebar, initStickyHeader }; 