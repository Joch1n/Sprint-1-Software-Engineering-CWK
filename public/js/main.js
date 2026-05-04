// ZeroWaste Connect - Advanced Frontend JavaScript

// ===========================
// MOBILE HAMBURGER MENU
// ===========================
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.querySelector('.nav-links-advanced');

  if (hamburger) {
    hamburger.addEventListener('click', function() {
      navLinks.classList.toggle('active');
    });

    // Close menu when clicking on a link
    const navItems = navLinks.querySelectorAll('a');
    navItems.forEach(link => {
      link.addEventListener('click', function() {
        navLinks.classList.remove('active');
      });
    });
  }

  // ===========================
  // MAP VIEW TOGGLE
  // ===========================
  const mapToggle = document.getElementById('mapToggle');
  const mapContainer = document.querySelector('.map-container');
  const foodGrid = document.getElementById('foodGrid');
  let mapInitialized = false;

  if (mapToggle) {
    mapToggle.addEventListener('click', function() {
      if (mapContainer.style.display === 'none') {
        mapContainer.style.display = 'block';
        mapToggle.classList.add('active');
        
        // Initialize map on first toggle
        if (!mapInitialized && window.L) {
          initializeMap();
          mapInitialized = true;
        }
      } else {
        mapContainer.style.display = 'none';
        mapToggle.classList.remove('active');
      }
    });
  }

  // ===========================
  // SEARCH & FILTER FUNCTIONALITY
  // ===========================
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const distanceFilter = document.getElementById('distanceFilter');

  if (searchInput) {
    searchInput.addEventListener('input', filterListings);
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', filterListings);
  }
  if (distanceFilter) {
    distanceFilter.addEventListener('change', filterListings);
  }

  function filterListings() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const category = categoryFilter ? categoryFilter.value : '';
    const distance = distanceFilter ? distanceFilter.value : '';

    const cards = document.querySelectorAll('.food-card-advanced');
    
    cards.forEach(card => {
      let shouldShow = true;
      
      // Search filter
      if (searchTerm) {
        const title = card.querySelector('.card-title').textContent.toLowerCase();
        const description = card.querySelector('.card-description').textContent.toLowerCase();
        if (!title.includes(searchTerm) && !description.includes(searchTerm)) {
          shouldShow = false;
        }
      }

      // Category filter
      if (category && shouldShow) {
        const badge = card.querySelector('.badge-category');
        if (badge && !badge.textContent.toLowerCase().includes(category)) {
          shouldShow = false;
        }
      }

      card.style.display = shouldShow ? '' : 'none';
    });

    // Show empty state if all cards are hidden
    const visibleCards = document.querySelectorAll('.food-card-advanced[style=""]');
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) {
      emptyState.style.display = visibleCards.length === 0 ? 'block' : 'none';
    }
  }

  // ===========================
  // VIEW TOGGLE (Grid / List)
  // ===========================
  const viewBtns = document.querySelectorAll('.view-btn');
  if (viewBtns.length > 0 && foodGrid) {
    viewBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        viewBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const viewType = this.dataset.view;
        if (viewType === 'list') {
          foodGrid.classList.add('list-view');
        } else {
          foodGrid.classList.remove('list-view');
        }
      });
    });
  }

  // ===========================
  // FAVORITE FUNCTIONALITY
  // ===========================
  const favoriteButtons = document.querySelectorAll('.btn-favorite');
  favoriteButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      this.classList.toggle('active');
      const icon = this.querySelector('i');
      if (this.classList.contains('active')) {
        icon.classList.remove('far');
        icon.classList.add('fas');
      } else {
        icon.classList.remove('fas');
        icon.classList.add('far');
      }
    });
  });
});

// ===========================
// LEAFLET MAP INITIALIZATION
// ===========================
function initializeMap() {
  if (!window.L) {
    console.error('Leaflet library not loaded');
    return;
  }

  const map = L.map('map').setView([51.505, -0.09], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Add markers for each listing
  const cards = document.querySelectorAll('.food-card-advanced');
  cards.forEach((card, index) => {
    const title = card.querySelector('.card-title').textContent;
    const location = card.querySelector('.meta-item span').textContent;
    
    // Example coordinates (you would get these from your backend)
    const coordinates = [51.5 + (Math.random() - 0.5) * 0.2, -0.09 + (Math.random() - 0.5) * 0.2];
    
    const marker = L.marker(coordinates).addTo(map);
    marker.bindPopup(`<b>${title}</b><br>${location}`);
  });
}

// ===========================
// SMOOTH SCROLL
// ===========================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ===========================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ===========================
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.food-card-advanced').forEach(card => {
  observer.observe(card);
});

// ===========================
// UTILITY FUNCTIONS
// ===========================

// Format distance
function formatDistance(km) {
  if (km < 1) {
    return Math.round(km * 1000) + 'm';
  }
  return km + 'km';
}

// Get user's location
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        error => {
          console.log('Geolocation error:', error);
          reject(error);
        }
      );
    } else {
      reject(new Error('Geolocation not supported'));
    }
  });
}

// Calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fade in animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);
