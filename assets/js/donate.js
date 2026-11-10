(function () {
  "use strict";

  var restoreTimers = new WeakMap();

  function copyViaClipboard(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }
    return Promise.reject(new Error("Clipboard API tidak tersedia."));
  }

  function copyViaInput(value) {
    return new Promise(function (resolve, reject) {
      try {
        var input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        var done = document.execCommand("copy");
        document.body.removeChild(input);
        if (done) {
          resolve();
        } else {
          reject(new Error("Penyalinan dibatalkan browser."));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function copyText(value) {
    return copyViaClipboard(value).catch(function () {
      return copyViaInput(value);
    });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-copy-account]");
    if (!button) {
      return;
    }

    var value = button.getAttribute("data-copy-account");
    var card = button.closest(".donate-card");
    var label = button.querySelector("[data-copy-label]");
    var icon = button.querySelector("use");
    var status = card ? card.querySelector(".donate-copy-status") : null;
    var timer = restoreTimers.get(button);

    if (timer) {
      window.clearTimeout(timer);
    }

    copyText(value).then(function () {
      button.classList.add("is-copied");
      if (label) {
        label.textContent = "Tersalin!";
      }
      if (icon) {
        icon.setAttribute("href", "#icon-check");
      }
      if (status) {
        status.textContent = "Nomor " + value + " disalin ke papan klip.";
      }
    }).catch(function () {
      if (status) {
        status.textContent = "Gagal menyalin. Salin nomornya secara manual, ya.";
      }
    }).then(function () {
      restoreTimers.set(button, window.setTimeout(function () {
        button.classList.remove("is-copied");
        if (label) {
          label.textContent = "Salin Nomor";
        }
        if (icon) {
          icon.setAttribute("href", "#icon-copy");
        }
        if (status) {
          status.textContent = "";
        }
      }, 2600));
    });
  });
})();
