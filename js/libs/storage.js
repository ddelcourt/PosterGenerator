/**
 * localStorage & URL Parameter Integration
 * Handles persistent state management and shareable URLs
 */

const Storage = (() => {
  const STORAGE_KEY = 'jazz-poster-state';

  /**
   * Parse URL parameters and return as object
   * Usage: ?w=89.5&h=128&seed=7&bg=%23ffffff
   */
  const parseURLParams = () => {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    
    for (const [key, value] of params.entries()) {
      // Try to parse as number
      if (!isNaN(value) && value !== '') {
        result[key] = +value;
      }
      // Try to parse as boolean
      else if (value === 'true') {
        result[key] = true;
      } else if (value === 'false') {
        result[key] = false;
      }
      // Keep as string
      else {
        result[key] = decodeURIComponent(value);
      }
    }
    
    return result;
  };

  /**
   * Generate shareable URL with current state
   */
  const generateShareURL = (state) => {
    const params = new URLSearchParams();
    
    Object.entries(state).forEach(([key, value]) => {
      if (typeof value === 'string' && value.startsWith('#')) {
        params.set(key, value);
      } else {
        params.set(key, value.toString());
      }
    });
    
    const baseURL = window.location.origin + window.location.pathname;
    return baseURL + '?' + params.toString();
  };

  /**
   * Copy share URL to clipboard
   */
  const copyShareURL = (state) => {
    const url = generateShareURL(state);
    navigator.clipboard.writeText(url).then(() => {
      console.log('✓ Share URL copied to clipboard');
      return true;
    }).catch(err => {
      console.error('Failed to copy URL:', err);
      return false;
    });
  };

  return {
    /**
     * Save state to localStorage
     */
    save: (state) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },

    /**
     * Load state from localStorage
     */
    load: () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    },

    /**
     * Load state from URL parameters (takes precedence over localStorage)
     */
    loadFromURL: () => {
      return parseURLParams();
    },

    /**
     * Initialize state: URL params > localStorage > defaults
     */
    initialize: (defaults) => {
      const urlParams = parseURLParams();
      const savedState = Storage.load() || {};
      
      // Merge: defaults < localStorage < URL params
      const state = { ...defaults, ...savedState, ...urlParams };
      
      return state;
    },

    /**
     * Export state as JSON string
     */
    exportJSON: (state) => {
      return JSON.stringify(state, null, 2);
    },

    /**
     * Import state from JSON string
     */
    importJSON: (json) => {
      try {
        return JSON.parse(json);
      } catch (e) {
        throw new Error('Invalid JSON: ' + e.message);
      }
    },

    /**
     * Generate shareable URL
     */
    getShareURL: (state) => {
      return generateShareURL(state);
    },

    /**
     * Copy share URL to clipboard
     */
    copyShareURL: (state) => {
      return copyShareURL(state);
    },

    /**
     * Clear localStorage
     */
    clear: () => {
      localStorage.removeItem(STORAGE_KEY);
    },

    /**
     * Get current URL without parameters
     */
    getBaseURL: () => {
      return window.location.origin + window.location.pathname;
    }
  };
})();
