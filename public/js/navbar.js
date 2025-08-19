// Shared navbar functionality for session management
async function checkUserSession() {
  try {
    const response = await fetch('/api/user');
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
