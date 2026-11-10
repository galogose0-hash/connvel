(function () {
  "use strict";

  var SESSION_KEY = "connvel_admin_session";
  var ADMIN_USERNAME = "connvel_owner_langlang";
  var ADMIN_PASSWORD = "C0nnv3l#2026_SecureAdmin!";
  var SESSION_DURATION = 8 * 60 * 60 * 1000;

  var form = document.getElementById("login-form");
  var usernameInput = document.getElementById("username");
  var passwordInput = document.getElementById("password");
  var passwordToggle = document.getElementById("password-toggle");
  var errorBox = document.getElementById("login-error");
  var submitButton = form.querySelector('button[type="submit"]');

  function hasActiveSession() {
    try {
      var session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY));
      return Boolean(session && session.expiresAt && Date.now() < session.expiresAt);
    } catch (error) {
      return false;
    }
  }

  if (hasActiveSession()) {
    window.location.replace("panel.html");
    return;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("is-visible");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.remove("is-visible");
  }

  passwordToggle.addEventListener("click", function () {
    var isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    passwordToggle.querySelector("[data-password-label]").textContent = isPassword ? "Tutup" : "Lihat";
    passwordToggle.setAttribute("aria-label", isPassword ? "Sembunyikan password" : "Tampilkan password");
    passwordInput.focus();
  });

  [usernameInput, passwordInput].forEach(function (input) {
    input.addEventListener("input", clearError);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearError();

    var username = usernameInput.value.trim();
    var password = passwordInput.value;

    if (!username || !password) {
      showError("Lengkapi username dan password terlebih dahulu.");
      (!username ? usernameInput : passwordInput).focus();
      return;
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      showError("Username atau password salah. Periksa kembali.");
      passwordInput.value = "";
      passwordInput.focus();
      return;
    }

    var now = Date.now();
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      user: ADMIN_USERNAME,
      loginAt: now,
      expiresAt: now + SESSION_DURATION
    }));

    submitButton.disabled = true;
    submitButton.textContent = "Membuka dashboard...";
    window.location.href = "panel.html";
  });
})();
