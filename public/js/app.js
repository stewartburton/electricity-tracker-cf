// Common utilities for Electricity Tracker
(function() {
    'use strict';
    
    // API configuration
    window.ElectricityTracker = window.ElectricityTracker || {};
    window.ElectricityTracker.API_URL = window.API_BASE_URL || '';
    
    // Auth utilities
    window.ElectricityTracker.auth = {
        getToken: function() {
            return localStorage.getItem('token');
        },
        
        setToken: function(token) {
            localStorage.setItem('token', token);
        },
        
        getUser: function() {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        },
        
        setUser: function(user) {
            localStorage.setItem('user', JSON.stringify(user));
        },
        
        isAuthenticated: function() {
            return !!this.getToken();
        },
        
        logout: function() {
            localStorage.clear();
            window.location.href = '/';
        },
        
        checkAuth: function() {
            if (!this.isAuthenticated()) {
                window.location.href = '/';
                return false;
            }
            return true;
        }
    };
    
    // API utilities
    window.ElectricityTracker.api = {
        request: async function(endpoint, options = {}) {
            const token = window.ElectricityTracker.auth.getToken();
            
            const defaultHeaders = {
                'Content-Type': 'application/json'
            };
            
            if (token) {
                defaultHeaders['Authorization'] = `Bearer ${token}`;
            }
            
            const config = {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...(options.headers || {})
                }
            };
            
            try {
                const response = await fetch(
                    `${window.ElectricityTracker.API_URL}${endpoint}`,
                    config
                );
                
                if (response.status === 401) {
                    window.ElectricityTracker.auth.logout();
                    return null;
                }
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Request failed');
                }
                
                return data;
            } catch (error) {
                console.error('API Error:', error);
                throw error;
            }
        },
        
        get: function(endpoint) {
            return this.request(endpoint, { method: 'GET' });
        },
        
        post: function(endpoint, data) {
            return this.request(endpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },
        
        put: function(endpoint, data) {
            return this.request(endpoint, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },
        
        delete: function(endpoint) {
            return this.request(endpoint, { method: 'DELETE' });
        }
    };
    
    // Utility functions
    window.ElectricityTracker.utils = {
        formatCurrency: function(amount) {
            return `R${(amount || 0).toFixed(2)}`;
        },
        
        formatDate: function(dateString) {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return 'Invalid Date';
            }
            return date.toLocaleDateString('en-ZA');
        },
        
        formatDateTime: function(dateString) {
            if (!dateString) {
                return 'No date';
            }
            
            let date = new Date(dateString);
            
            // If date is invalid, try different parsing approaches
            if (isNaN(date.getTime())) {
                // Try parsing as various formats
                if (typeof dateString === 'string') {
                    // Try to parse manually if needed
                    const parts = dateString.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                    if (parts) {
                        date = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
                    }
                }
                
                if (isNaN(date.getTime())) {
                    return 'Invalid Date';
                }
            }
            
            // Check if the original string was just a date (no time component)
            const isDateOnly = dateString && dateString.length === 10 && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
            
            if (isDateOnly) {
                // For date-only entries, just show the date without time
                return date.toLocaleDateString('en-ZA', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            } else {
                // For entries with time, show both date and time
                return date.toLocaleDateString('en-ZA', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }) + ', ' + date.toLocaleTimeString('en-ZA', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }
        },
        
        showMessage: function(message, type = 'info') {
            // You can implement a toast/notification system here
            if (type === 'error') {
                console.error(message);
                alert('Error: ' + message);
            } else {
                console.log(message);
                // Could show a success toast here
            }
        },
        
        showLoading: function(show = true) {
            // Implement loading indicator
            const loader = document.getElementById('loader');
            if (loader) {
                loader.style.display = show ? 'block' : 'none';
            }
        }
    };
    
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Add logout handler if logout link exists
        const logoutLink = document.getElementById('logout');
        if (logoutLink) {
            logoutLink.addEventListener('click', function(e) {
                e.preventDefault();
                window.ElectricityTracker.auth.logout();
            });
        }
    });
    
})();