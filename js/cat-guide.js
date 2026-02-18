/**
 * ========== CAT GUIDE MODULE ==========
 * Interactive cat character for home page guidance
 * 
 * Purpose: Display personalized greetings and guide user actions
 * Modular design allows extension for in-quiz tutor functionality
 * 
 * Future Integration Points:
 * - Quiz mode: Cat responds to quiz events
 * - Score tracking: Cat reacts to performance
 * - Hint system: Cat provides quiz hints
 */

class CatGuide {
  constructor() {
    this.catGreeting = document.getElementById("catGreeting");
    this.catActions = document.getElementById("catActions");
    this.catCloseBtn = document.getElementById("catCloseBtn");
    this.catGuideSection = document.getElementById("catGuideSection");
    this.categoryBtns = document.querySelectorAll(".category-btn");
    
    // User data
    this.user = this.getCurrentUser();
    
    // Initialize
    this.init();
  }

  /**
   * Get current logged-in user from localStorage
   * @returns {Object|null} User object or null
   */
  getCurrentUser() {
    const userKey = "quizionix_current_user";
    try {
      return JSON.parse(localStorage.getItem(userKey) || "null");
    } catch (e) {
      console.warn("Could not retrieve user data:", e);
      return null;
    }
  }

  /**
   * Initialize cat guide interactions
   */
  init() {
    this.setGreeting();
    this.setupEventListeners();
  }

  /**
   * Set personalized greeting with user name
   */
  setGreeting() {
    const userName = this.user?.name || "Friend";
    const greetings = [
      `Hi, ${userName}! Ready to start your adventure?`,
      `Welcome back, ${userName}! Let's learn together!`,
      `Hey ${userName}! What shall we explore today?`,
      `Great to see you, ${userName}! Pick a challenge!`
    ];
    
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    if (this.catGreeting) {
      this.catGreeting.textContent = randomGreeting;
    }
  }

  /**
   * Setup event listeners for cat actions
   */
  setupEventListeners() {
    // Cat action buttons
    const actionBtns = this.catActions?.querySelectorAll(".cat-action-btn");
    actionBtns?.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const action = e.target.dataset.action;
        this.handleAction(action);
      });
    });

    // Close cat guide
    this.catCloseBtn?.addEventListener("click", () => {
      this.closeCatGuide();
    });

    // Category navigation buttons
    this.categoryBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const category = btn.closest(".game-card")?.dataset.category;
        this.handleCategoryClick(category);
      });
    });
  }

  /**
   * Handle cat action button clicks
   * @param {string} action - Action type (start-quiz, explore, progress)
   */
  handleAction(action) {
    switch(action) {
      case "start-quiz":
        this.showMessage("Choose a category to get started! 📚");
        this.scrollToCategories();
        break;
      case "explore":
        this.showMessage("Explore all quiz categories below and pick your favorite! 🔍");
        this.scrollToCategories();
        break;
      case "progress":
        this.showMessage("View your progress feature coming soon! Keep learning! 🚀");
        break;
      default:
        break;
    }
  }

  /**
   * Handle category card clicks
   * @param {string} category - Category name (science, math, history, etc.)
   */
  handleCategoryClick(category) {
    const categoryNames = {
      science: "Science Quest",
      math: "Math Arena",
      history: "History Run"
    };
    
    const categoryName = categoryNames[category] || "Quiz";
    this.showMessage(`${categoryName} is coming soon! We're preparing the ultimate experience for you! 🎓`, 2500);
  }

  /**
   * Display temporary message from cat
   * @param {string} message - Message to display
   * @param {number} duration - Duration in ms (default: 3000)
   */
  showMessage(message, duration = 3000) {
    if (!this.catGreeting) return;
    
    const originalText = this.catGreeting.textContent;
    this.catGreeting.textContent = message;
    
    // Use GSAP if available for smooth transition
    if (typeof gsap !== "undefined") {
      gsap.fromTo(
        this.catGreeting,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power1.out" }
      );
      
      gsap.delayedCall(duration / 1000, () => {
        gsap.to(this.catGreeting, {
          opacity: 0,
          y: -10,
          duration: 0.3,
          ease: "power1.in",
          onComplete: () => {
            this.catGreeting.textContent = originalText;
            gsap.to(this.catGreeting, {
              opacity: 1,
              y: 0,
              duration: 0.3,
              ease: "power1.out"
            });
          }
        });
      });
    } else {
      // Fallback without GSAP
      setTimeout(() => {
        this.catGreeting.textContent = originalText;
      }, duration);
    }
  }

  /**
   * Smooth scroll to categories section
   */
  scrollToCategories() {
    const grid = document.querySelector(".grid");
    if (grid) {
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /**
   * Close cat guide section
   */
  closeCatGuide() {
    if (this.catGuideSection) {
      if (typeof gsap !== "undefined") {
        gsap.to(this.catGuideSection, {
          opacity: 0,
          y: -20,
          duration: 0.3,
          ease: "power1.in",
          onComplete: () => {
            this.catGuideSection.classList.add("hidden");
          }
        });
      } else {
        this.catGuideSection.classList.add("hidden");
      }
    }
  }

  /**
   * Show cat guide (reopen)
   * Used for future features
   */
  showCatGuide() {
    if (this.catGuideSection) {
      this.catGuideSection.classList.remove("hidden");
      if (typeof gsap !== "undefined") {
        gsap.fromTo(
          this.catGuideSection,
          { opacity: 0, y: -20 },
          { opacity: 1, y: 0, duration: 0.4, ease: "back.out" }
        );
      }
    }
  }

  /**
   * Update cat greeting with custom text
   * Used for quiz mode or special events
   * @param {string} message - New greeting message
   */
  updateGreeting(message) {
    if (this.catGreeting) {
      this.catGreeting.textContent = message;
    }
  }

  /**
   * Disable/Enable cat actions during quiz or loading
   * @param {boolean} disabled - True to disable
   */
  setActionsDisabled(disabled) {
    const actionBtns = this.catActions?.querySelectorAll(".cat-action-btn");
    actionBtns?.forEach(btn => {
      btn.disabled = disabled;
      btn.style.opacity = disabled ? "0.5" : "1";
    });
  }
}

// Initialize cat guide when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Only initialize on home page
  if (document.getElementById("catGuideSection")) {
    window.catGuide = new CatGuide();
  }
});
