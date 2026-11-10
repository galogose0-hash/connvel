(function () {
  "use strict";

  var form = document.getElementById("novelis-form");
  if (!form) {
    return;
  }

  var statusEl = document.getElementById("submission-status");
  var submitButton = form.querySelector('button[type="submit"]');
  var submitLabel = submitButton ? submitButton.querySelector("[data-submit-label]") : null;
  var defaultLabel = submitLabel ? submitLabel.textContent : "";
  var sending = false;

  function setStatus(message, state) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message;
    statusEl.className = "form-status submission-status" + (state ? " is-" + state : "");
  }

  function setSending(isSending) {
    sending = isSending;
    if (submitButton) {
      submitButton.disabled = isSending;
    }
    if (submitLabel) {
      submitLabel.textContent = isSending ? "Mengirim Naskah..." : defaultLabel;
    }
  }

  function readPayload() {
    var data = new FormData(form);
    return {
      name: String(data.get("author_name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("whatsapp") || "").trim(),
      novelTitle: String(data.get("novel_title") || "").trim(),
      chapter: String(data.get("chapter_info") || "").trim(),
      message: String(data.get("content") || "").trim()
    };
  }

  function validate(payload) {
    if (!payload.name) {
      return "Nama penulis wajib diisi.";
    }
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) {
      return "Alamat email belum valid.";
    }
    if (payload.phone.replace(/\D/g, "").length < 8) {
      return "Nomor WhatsApp belum valid.";
    }
    if (!payload.novelTitle) {
      return "Judul novel wajib diisi.";
    }
    if (!payload.chapter) {
      return "Bab / episode wajib diisi.";
    }
    if (!payload.message) {
      return "Isi cerita wajib diisi.";
    }
    return "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (sending) {
      return;
    }

    var payload = readPayload();
    var problem = validate(payload);
    if (problem) {
      setStatus(problem, "error");
      return;
    }

    setSending(true);
    setStatus("Mengirim naskah ke redaksi...", "");

    window.fetch("/api/submissions", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.text().then(function (text) {
        var body = {};
        try {
          body = text ? JSON.parse(text) : {};
        } catch (error) {
          body = {};
        }
        if (!response.ok) {
          throw new Error(body.error || "Server mengembalikan status " + response.status + ".");
        }
        return body;
      });
    }).then(function () {
      form.reset();
      setStatus("Naskahmu sudah masuk ke Kotak Masuk Penulis. Redaksi Connvel akan meninjaunya dan menghubungimu lewat email atau WhatsApp.", "success");
    }).catch(function (error) {
      setStatus((error && error.message ? error.message : "Naskah gagal dikirim.") + " Pastikan server Connvel aktif (npm start), lalu coba lagi.", "error");
    }).then(function () {
      setSending(false);
    });
  });
})();
