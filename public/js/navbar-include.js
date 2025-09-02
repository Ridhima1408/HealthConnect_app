// Standard navbar HTML for all pages
function createNavbar(activePage = '') {
  return `
    <!-- Emergency Banner -->
    <div class="emergency-banner">
      <div class="emergency-text">
        🚨 FOR EMERGENCY OR AMBULANCE SERVICES CALL 108 • URGENT CARE AVAILABLE 24/7 • CALL +91 8945567890 🚨
      </div>
    </div>
    
    <!-- Navigation Bar -->
    <nav class="navbar">
      <div class="container nav-container">
        <h1 class="logo">HealthConnect+</h1>
        
        <!-- Mobile Menu Toggle -->
        <div class="mobile-menu-toggle" onclick="toggleMobileMenu()">
          <span></span>
          <span></span>
          <span></span>
        </div>
        
        <div class="nav-links" id="navLinks">
          <a href="index.html" ${activePage === 'home' ? 'class="active"' : ''}>Home</a>
          <a href="book.html" ${activePage === 'book' ? 'class="active"' : ''}>Book Appointment</a>
          <a href="consultation.html" ${activePage === 'consultation' ? 'class="active"' : ''}>Online Consultation</a>
          <a href="doctors.html" ${activePage === 'doctors' ? 'class="active"' : ''}>Doctors</a>
          <a href="about.html" ${activePage === 'about' ? 'class="active"' : ''}>About</a>
          <a href="contact.html" ${activePage === 'contact' ? 'class="active"' : ''}>Contact</a>
          <div id="user-nav">
            <a href="login.html" id="login-link">Login</a>
            <div id="user-menu" style="display: none;">
              <span id="username-display">Welcome, User!</span>
              <form action="/logout" method="POST" style="display: inline;">
                <button type="submit" id="logout-btn">Logout</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;
}

// Mobile Menu Toggle Function
function toggleMobileMenu() {
  const navLinks = document.getElementById('navLinks');
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  
  if (navLinks) navLinks.classList.toggle('mobile-open');
  if (mobileToggle) mobileToggle.classList.toggle('active');
}

// Close mobile menu when clicking on a link
function initializeMobileMenu() {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      const navLinks = document.getElementById('navLinks');
      const mobileToggle = document.querySelector('.mobile-menu-toggle');
      if (navLinks) navLinks.classList.remove('mobile-open');
      if (mobileToggle) mobileToggle.classList.remove('active');
    });
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize mobile menu after navbar is loaded
  setTimeout(() => {
    initializeMobileMenu();
  }, 100);
});
