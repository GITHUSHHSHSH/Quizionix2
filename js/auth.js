const USERS_KEY = "quizionix_users";
const CURRENT_USER_KEY = "quizionix_current_user";

function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function showError(el, message) {
  if (el) el.textContent = message || "";
}

function isFatimaEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@student\.fatima\.edu\.ph$/i.test(email);
}

// Password visibility toggles
for (const btn of document.querySelectorAll(".toggle-password")) {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    target.type = target.type === "password" ? "text" : "password";
  });
}

// Sign Up logic
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  const submitBtn = document.getElementById("signupSubmit");
  const termsCheck = document.getElementById("agreeTerms");
  const errorEl = document.getElementById("signupError");

  termsCheck.addEventListener("change", () => {
    submitBtn.disabled = !termsCheck.checked;
  });

  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    showError(errorEl, "");

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;
    const confirm = document.getElementById("signupConfirm").value;

    if (!name || !email || !password || !confirm) {
      showError(errorEl, "Please fill in all fields.");
      return;
    }

    if (!isFatimaEmail(email)) {
      showError(errorEl, "Use a valid @student.fatima.edu.ph email.");
      return;
    }

    if (password.length < 6) {
      showError(errorEl, "Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      showError(errorEl, "Passwords do not match.");
      return;
    }

    if (!termsCheck.checked) {
      showError(errorEl, "You must agree to the Terms of Service.");
      return;
    }

    const users = getUsers();
    if (users.some((u) => u.email === email)) {
      showError(errorEl, "This email is already registered.");
      return;
    }

    users.push({ name, email, password });
    saveUsers(users);
    window.location.href = "signin.html";
  });
}

// Sign In logic
const signinForm = document.getElementById("signinForm");
if (signinForm) {
  const errorEl = document.getElementById("signinError");

  signinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    showError(errorEl, "");

    const identifier = document.getElementById("signinIdentifier").value.trim().toLowerCase();
    const password = document.getElementById("signinPassword").value;
    const users = getUsers();

    const user = users.find(
      (u) =>
        (u.email.toLowerCase() === identifier || u.name.toLowerCase() === identifier) &&
        u.password === password
    );

    if (!user) {
      showError(errorEl, "Invalid login. Please check your credentials.");
      return;
    }

    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ name: user.name, email: user.email }));

    // Cat greeting triggers in home.js after redirect.
    window.location.href = "home.html";
  });
}
