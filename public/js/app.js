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
            return new Date(dateString).toLocaleDateString('en-ZA');
        },
        
        formatDateTime: function(dateString) {
            return new Date(dateString).toLocaleString('en-ZA');
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