(function () {
  "use strict";

  var SESSION_KEY = "connvel_admin_session";
  var SESSION_DURATION = 8 * 60 * 60 * 1000;

  var form = document.getElementById("login-form");
  var keyInput = document.getElementById("admin-key");
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

  function resetSubmit() {
    submitButton.disabled = false;
    submitButton.textContent = "Masuk ke Dashboard";
  }

  passwordToggle.addEventListener("click", function () {
    var isPassword = keyInput.type === "password";
    keyInput.type = isPassword ? "text" : "password";
    passwordToggle.querySelector("[data-password-label]").textContent = isPassword ? "Tutup" : "Lihat";
    passwordToggle.setAttribute("aria-label", isPassword ? "Sembunyikan kunci" : "Tampilkan kunci");
    keyInput.focus();
  });

  keyInput.addEventListener("input", clearError);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearError();

    var key = keyInput.value.trim();
    if (!key) {
      showError("Masukkan kunci admin terlebih dahulu.");
      keyInput.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Memeriksa kunci...";

    window.fetch("/api/state", {
      method: "GET",
      cache: "no-store",
      headers: { "Authorization": "Bearer " + key }
    }).then(function (response) {
      if (response.status === 401) {
        throw new Error("Kunci admin salah. Periksa kembali.");
      }
      if (!response.ok) {
        throw new Error("Server mengembalikan status " + response.status + ". Coba lagi sebentar lagi.");
      }

      var now = Date.now();
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        token: key,
        user: "admin",
        loginAt: now,
        expiresAt: now + SESSION_DURATION
      }));
      window.location.href = "panel.html";
    }).catch(function (error) {
      resetSubmit();
      showError(error.message || "Gagal memeriksa kunci. Pastikan koneksi tersedia.");
      keyInput.value = "";
      keyInput.focus();
    });
  });
})();
