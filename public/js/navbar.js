// Shared navbar functionality for session management
async function checkUserSession() {
  try {
    // Safe way to get API URL with fallback
    let apiURL = '/api/user';
    if (window.CONFIG && typeof window.CONFIG.getAPIURL === 'function') {
      try {
        apiURL = window.CONFIG.getAPIURL('user');
      } catch (configError) {
        console.warn('Config error in navbar, using fallback API URL:', configError);
      }
    }
    
    const response = await fetch(apiURL);
    const data = await response.json();
    
    const loginLink = document.getElementById('login-link');
    const userMenu = document.getElementById('user-menu');
    const usernameDisplay = document.getElementById('username-display');
    
    if (data.loggedIn) {
      if (loginLink) loginLink.style.display = 'none';
      if (userMenu) userMenu.style.display = 'inline-flex';
      if (usernameDisplay) usernameDisplay.textContent = `Welcome, ${data.user.username}!`;
    } else {
      if (loginLink) loginLink.style.display = 'inline';
      if (userMenu) userMenu.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking user session:', error);
  }
}

// Initialize navbar on DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
  checkUserSession();
});
