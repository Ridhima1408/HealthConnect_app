// Simple inline configuration as backup
if (!window.CONFIG) {
  window.CONFIG = {
    getAPIURL: function(endpoint) {
      const isProduction = window.location.hostname !== 'localhost' && 
                           window.location.hostname !== '127.0.0.1' && 
                           window.location.hostname !== '';
      
      const baseURL = isProduction ? 
        `${window.location.protocol}//${window.location.host}` : 
        'http://localhost:3000';
      
      const endpoints = {
        user: '/api/user',
        login: '/login',
        logout: '/logout',
        register: '/register',
        book: '/book'
      };
      
      return baseURL + endpoints[endpoint];
    }
  };
  console.log('🔄 Using simple CONFIG fallback');
}
