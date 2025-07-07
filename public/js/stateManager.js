/**
 * Centralized State Manager for Baby Registry
 * Manages all application state and provides event-driven updates
 */

import { DEBUG_MODE } from './constants.js';

class StateManager {
    constructor() {
        this.state = {
            // UI State
            sidebar: {
                isOpen: false,
                isMobile: false
            },
            
            // Filter & Search State
            filters: {
                status: 'all', // 'all', 'available', 'taken'
                searchTerm: '',
                searchDebounceTimer: null
            },
            
            // Category State
            categories: {
                expandedCategories: new Set(),
                allExpanded: true, // Default state
                allCollapsed: false
            },
            
            // Item State
            items: {
                data: [],
                lastKnownState: null,
                loading: true
            },
            
            // Sticky Header State
            stickyHeader: {
                isVisible: false,
                heroHeight: 0
            },
            
            // Modal State
            modal: {
                isOpen: false,
                type: null,
                data: null
            }
        };
        
        this.listeners = new Map();
        
        if (DEBUG_MODE) {
            console.log('StateManager initialized');
            // Expose state to global scope for debugging
            window.appState = this;
        }
    }
    
    /**
     * Subscribe to state changes
     * @param {string} path - Dot notation path to state (e.g., 'sidebar.isOpen' or 'filters')
     * @param {function} callback - Function to call when state changes
     * @returns {function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        
        this.listeners.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.get(path)?.delete(callback);
        };
    }
    
    /**
     * Update state and notify subscribers
     * @param {string} path - Dot notation path to state
     * @param {any} value - New value
     */
    setState(path, value) {
        const oldValue = this.getState(path);
        this.setStateValue(path, value);
        
        if (DEBUG_MODE) {
            console.log(`State updated: ${path}`, { oldValue, newValue: value });
        }
        
        // Notify subscribers for this specific path
        this.notifySubscribers(path, value, oldValue);
        
        // Also notify parent path subscribers
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            this.notifySubscribers(parentPath, this.getState(parentPath), oldValue);
        }
    }
    
    /**
     * Get state value by path
     * @param {string} path - Dot notation path to state
     * @returns {any} State value
     */
    getState(path) {
        return this.getStateValue(path);
    }
    
    /**
     * Update multiple state values at once
     * @param {Object} updates - Object with path: value pairs
     */
    setBatch(updates) {
        const oldValues = {};
        
        // Collect old values
        Object.keys(updates).forEach(path => {
            oldValues[path] = this.getState(path);
        });
        
        // Update all values
        Object.entries(updates).forEach(([path, value]) => {
            this.setStateValue(path, value);
        });
        
        if (DEBUG_MODE) {
            console.log('Batch state update:', updates);
        }
        
        // Notify all subscribers
        Object.entries(updates).forEach(([path, value]) => {
            this.notifySubscribers(path, value, oldValues[path]);
        });
    }
    
    // Helper methods
    setStateValue(path, value) {
        const keys = path.split('.');
        let current = this.state;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }
    
    getStateValue(path) {
        const keys = path.split('.');
        let current = this.state;
        
        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }
    
    notifySubscribers(path, newValue, oldValue) {
        const callbacks = this.listeners.get(path);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error(`Error in state listener for ${path}:`, error);
                }
            });
        }
    }
    
    // Convenience methods for common state operations
    toggleSidebar() {
        const isOpen = this.getState('sidebar.isOpen');
        this.setState('sidebar.isOpen', !isOpen);
    }
    
    openSidebar() {
        this.setState('sidebar.isOpen', true);
    }
    
    closeSidebar() {
        this.setState('sidebar.isOpen', false);
    }
    
    setFilter(filterType, value) {
        this.setState(`filters.${filterType}`, value);
    }
    
    toggleCategory(categoryId) {
        const expanded = this.getState('categories.expandedCategories');
        const newExpanded = new Set(expanded);
        
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        
        this.setState('categories.expandedCategories', newExpanded);
        this.updateCategoryControlState();
    }
    
    expandAllCategories() {
        // Get all category IDs from DOM
        const categoryElements = document.querySelectorAll('.category-items');
        const allCategoryIds = Array.from(categoryElements).map(el => el.dataset.category);
        
        this.setBatch({
            'categories.expandedCategories': new Set(allCategoryIds),
            'categories.allExpanded': true,
            'categories.allCollapsed': false
        });
    }
    
    collapseAllCategories() {
        this.setBatch({
            'categories.expandedCategories': new Set(),
            'categories.allExpanded': false,
            'categories.allCollapsed': true
        });
    }
    
    updateCategoryControlState() {
        const expanded = this.getState('categories.expandedCategories');
        const categoryElements = document.querySelectorAll('.category-items');
        const totalCategories = categoryElements.length;
        const expandedCount = expanded.size;
        
        this.setBatch({
            'categories.allExpanded': expandedCount === totalCategories,
            'categories.allCollapsed': expandedCount === 0
        });
    }
    
    setItems(items) {
        const newState = JSON.stringify(items);
        const hasChanged = newState !== this.getState('items.lastKnownState');
        
        if (hasChanged) {
            this.setBatch({
                'items.data': items,
                'items.lastKnownState': newState,
                'items.loading': false
            });
        }
        
        return hasChanged;
    }
    
    setItemsLoading(loading) {
        this.setState('items.loading', loading);
    }
    
    openModal(type, data = null) {
        this.setBatch({
            'modal.isOpen': true,
            'modal.type': type,
            'modal.data': data
        });
    }
    
    closeModal() {
        this.setBatch({
            'modal.isOpen': false,
            'modal.type': null,
            'modal.data': null
        });
    }
}

// Create singleton instance
const stateManager = new StateManager();

export default stateManager; 