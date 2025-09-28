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
            
            // Check if this is a date-only string (YYYY-MM-DD format without time)
            const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
            if (dateOnlyPattern.test(dateString.trim())) {
                // For date-only entries, just show the date without time
                const date = new Date(dateString + 'T00:00:00');
                return date.toLocaleDateString('en-ZA', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            }
            
            // Parse the date - handle both SQL datetime format and ISO format
            let date = new Date(dateString);
            
            // If date is invalid, try different parsing approaches
            if (isNaN(date.getTime())) {
                // Try parsing SQL datetime format: "2025-09-06 11:36:02"
                if (typeof dateString === 'string' && dateString.includes(' ')) {
                    const [datePart, timePart] = dateString.split(' ');
                    date = new Date(datePart + 'T' + timePart);
                }
                
                // If still invalid, try manual parsing
                if (isNaN(date.getTime())) {
                    const parts = dateString.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                    if (parts) {
                        date = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
                    }
                }
                
                if (isNaN(date.getTime())) {
                    return 'Invalid Date';
                }
            }
            
            // Always show both date and time for datetime entries
            return date.toLocaleDateString('en-ZA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }) + ', ' + date.toLocaleTimeString('en-ZA', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        showMessage: function(message, type = 'info') {
            const messageDiv = document.createElement('div');
            messageDiv.className = `${type}-message`;
            messageDiv.innerHTML = message;

            const backgroundColor = type === 'error' ? '#dc3545' : '#28a745';

            messageDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${backgroundColor};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            `;

            // Add CSS animations if not already present
            if (!document.getElementById('message-animations')) {
                const style = document.createElement('style');
                style.id = 'message-animations';
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes slideOut {
                        from { transform: translateX(0); opacity: 1; }
                        to { transform: translateX(100%); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }

            document.body.appendChild(messageDiv);

            // Auto-remove after 3 seconds
            setTimeout(() => {
                messageDiv.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => messageDiv.remove(), 300);
            }, 3000);

            // Also log to console for debugging
            if (type === 'error') {
                console.error(message);
            } else {
                console.log(message);
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