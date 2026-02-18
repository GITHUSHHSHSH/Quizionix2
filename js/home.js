const CURRENT_USER_KEY = "quizionix_current_user";

const user = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "null");
if (!user) {
  window.location.href = "signin.html";
} else {
  const welcomeTitle = document.getElementById("welcomeTitle");
  const catBubble = document.getElementById("catBubble");

  if (welcomeTitle) {
    welcomeTitle.textContent = `Welcome, ${user.name}!`;
  }

  const messages = [
    `Hi, ${user.name}!`,
    "Pick a category to start your first quiz mission.",
    "I will be your in-quiz tutor soon. Placeholder active."
  ];

  let index = 0;
  if (catBubble) {
    catBubble.textContent = messages[index];
    const interval = setInterval(() => {
      index += 1;
      if (index >= messages.length) {
        clearInterval(interval);
        return;
      }
      catBubble.textContent = messages[index];
    }, 2500);
  }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = "signin.html";
  });
}

const categoryButtons = document.querySelectorAll(".category-btn");
categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    window.location.href = "game.html";
  });
});
