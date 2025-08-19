// Environment configuration for HealthConnect+
const CONFIG = {
  // Detect if we're running in production (AWS) or development (localhost)
  isProduction: () => {
    return window.location.hostname !== 'localhost' && 
           window.location.hostname !== '127.0.0.1' && 
           window.location.hostname !== '';
  },
  
  // Get the base API URL based on environment
  getAPIBaseURL: () => {
    if (CONFIG.isProduction()) {
      // Production: Use the current host (AWS instance)
      return `${window.location.protocol}//${window.location.host}`;
    } else {
      // Development: Use localhost
      return 'http://localhost:3000';
    }
  },
  
  // API endpoints
  endpoints: {
    user: '/api/user',
    login: '/login', 
    logout: '/logout',
    register: '/register',
    book: '/book'
  },
  
  // Get full API URL
  getAPIURL: (endpoint) => {
    return CONFIG.getAPIBaseURL() + CONFIG.endpoints[endpoint];
  }
};

// Debug info (remove in production)
console.log('🔧 HealthConnect+ Config:', {
  environment: CONFIG.isProduction() ? 'Production' : 'Development',
  hostname: window.location.hostname,
  baseURL: CONFIG.getAPIBaseURL(),
  userAPI: CONFIG.getAPIURL('user')
});
