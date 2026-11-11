(function () {
  "use strict";

  var bookmarkButton = document.querySelector("[data-bookmark]");
  if (bookmarkButton) {
    bookmarkButton.addEventListener("click", function () {
      var saved = bookmarkButton.getAttribute("aria-pressed") === "true";
      var label = bookmarkButton.querySelector("[data-bookmark-label]");

      bookmarkButton.setAttribute("aria-pressed", String(!saved));
      if (label) {
        label.textContent = saved ? "Simpan ke Perpustakaan" : "Tersimpan di Perpustakaan";
      }
    });
  }

  var shareButton = document.querySelector("[data-share]");
  var shareStatus = document.querySelector("[data-share-status]");
  var shareTimer = null;

  function showShareStatus(message) {
    if (!shareStatus) return;
    shareStatus.textContent = message;
    window.clearTimeout(shareTimer);
    shareTimer = window.setTimeout(function () {
      shareStatus.textContent = "";
    }, 4000);
  }

  if (shareButton) {
    shareButton.addEventListener("click", function () {
      var payload = {
        title: document.title,
        text: "Baca \"Putri Sang Kartografer\" di Connvel.",
        url: window.location.href
      };

      if (navigator.share) {
        navigator.share(payload).then(function () {
          showShareStatus("Tautan berhasil dibagikan.");
        }).catch(function () {});
        return;
      }

      if (navigator.clipboard) {
        navigator.clipboard.writeText(payload.url).then(function () {
          showShareStatus("Tautan disalin ke papan klip.");
        }).catch(function () {
          showShareStatus("Salin tautan dari bilah alamat.");
        });
        return;
      }

      showShareStatus("Salin tautan dari bilah alamat.");
    });
  }

  var commentForm = document.querySelector(".comment-form");
  var discussionPanel = document.querySelector("[data-novel-id]");

  if (commentForm) {
    var NAME_STORAGE_KEY = "connvel_commenter_name";
    var commentInput = commentForm.querySelector(".comment-input");
    var nameInput = commentForm.querySelector(".comment-name-input");
    var commentStatus = commentForm.querySelector(".comment-status");
    var commentList = document.querySelector(".comment-list");
    var commentCount = document.querySelector("[data-comment-count]");
    var novelId = discussionPanel ? discussionPanel.getAttribute("data-novel-id") : "";
    var comments = [];

    function setCommentStatus(message, state) {
      if (!commentStatus) return;
      commentStatus.textContent = message;
      commentStatus.className = "form-status comment-status" + (state ? " is-" + state : "");
    }

    function formatCommentTime(value) {
      var date = new Date(value);
      if (isNaN(date.getTime())) {
        return "";
      }
      var now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return "Hari ini, " + new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
      }
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(date);
    }

    function buildCommentCard(comment) {
      var card = document.createElement("li");
      card.className = "comment-card";
      card.setAttribute("data-comment-id", String(comment.id || ""));

      var avatar = document.createElement("span");
      avatar.className = "comment-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = (comment.name || "?").charAt(0).toUpperCase();

      var body = document.createElement("div");
      body.className = "comment-body";

      var head = document.createElement("div");
      head.className = "comment-head";

      var name = document.createElement("span");
      name.className = "comment-name";
      name.textContent = comment.name || "Pembaca Connvel";

      head.appendChild(name);
      var timeText = formatCommentTime(comment.date);
      if (timeText) {
        var time = document.createElement("span");
        time.className = "comment-time";
        time.textContent = timeText;
        head.appendChild(time);
      }

      var text = document.createElement("p");
      text.className = "comment-text";
      text.textContent = comment.message || "";

      body.appendChild(head);
      body.appendChild(text);
      card.appendChild(avatar);
      card.appendChild(body);
      return card;
    }

    function renderComments() {
      if (!commentList) {
        return;
      }
      var own = comments.filter(function (comment) {
        return String(comment.novelId) === String(novelId);
      }).sort(function (a, b) {
        return new Date(b.date || 0) - new Date(a.date || 0);
      });

      commentList.innerHTML = "";
      own.forEach(function (comment) {
        commentList.appendChild(buildCommentCard(comment));
      });

      if (commentCount) {
        commentCount.textContent = own.length
          ? own.length + " komentar"
          : "Belum ada komentar. Mulai diskusinya!";
      }
    }

    function loadLocalComments() {
      try {
        if (window.ConnvelStore) {
          var data = window.ConnvelStore.load();
          comments = Array.isArray(data.comments) ? data.comments : [];
        }
      } catch (error) {
        comments = [];
      }
      renderComments();
    }

    function loadComments() {
      if (!window.fetch) {
        loadLocalComments();
        return;
      }
      window.fetch("/api/state", { cache: "no-store" }).then(function (response) {
        if (!response.ok) {
          throw new Error("Backend tidak tersedia.");
        }
        return response.json();
      }).then(function (payload) {
        var state = payload && payload.state ? payload.state : payload;
        comments = state && Array.isArray(state.comments) ? state.comments : [];
        renderComments();
      }).catch(function () {
        loadLocalComments();
      });
    }

    function saveLocalComment(comment) {
      try {
        if (!window.ConnvelStore) {
          return;
        }
        var data = window.ConnvelStore.load();
        if (!Array.isArray(data.comments)) {
          data.comments = [];
        }
        data.comments.push(comment);
        window.ConnvelStore.save(data);
      } catch (error) {
        /* Penyimpanan browser hanya cadangan saat backend offline. */
      }
    }

    function acceptComment(comment, isLocal) {
      comments.unshift(comment);
      renderComments();
      if (isLocal) {
        saveLocalComment(comment);
      }
      if (commentInput) {
        commentInput.value = "";
        commentInput.removeAttribute("aria-invalid");
      }
    }

    function localCommentId() {
      return "com-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
    }

    commentForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var name = nameInput ? nameInput.value.trim() : "";
      var value = commentInput ? commentInput.value.trim() : "";

      if (!name) {
        if (nameInput) {
          nameInput.setAttribute("aria-invalid", "true");
          nameInput.focus();
        }
        setCommentStatus("Isi nama kamu dulu, ya.", "error");
        return;
      }

      if (!value) {
        if (commentInput) {
          commentInput.setAttribute("aria-invalid", "true");
          commentInput.focus();
        }
        setCommentStatus("Tulis komentar terlebih dahulu, ya.", "error");
        return;
      }

      if (nameInput) {
        nameInput.removeAttribute("aria-invalid");
      }
      if (commentInput) {
        commentInput.removeAttribute("aria-invalid");
      }

      try {
        window.localStorage.setItem(NAME_STORAGE_KEY, name);
      } catch (error) {
        /* Nama tersimpan hanya untuk kenyamanan, boleh gagal. */
      }

      var fallback = {
        id: localCommentId(),
        novelId: novelId,
        name: name,
        message: value,
        date: new Date().toISOString()
      };

      if (!window.fetch) {
        acceptComment(fallback, true);
        setCommentStatus("Komentarmu tersimpan di browser.", "success");
        return;
      }

      setCommentStatus("Mengirim komentar...", null);

      window.fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId: novelId, name: name, message: value })
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("Gagal mengirim komentar.");
        }
        return response.json();
      }).then(function (payload) {
        acceptComment(payload && payload.comment ? payload.comment : fallback, false);
        setCommentStatus("Komentarmu sudah terkirim. Terima kasih sudah berbagi!", "success");
      }).catch(function () {
        acceptComment(fallback, true);
        setCommentStatus("Komentarmu tersimpan di browser ini. Terima kasih sudah berbagi!", "success");
      });
    });

    if (nameInput) {
      try {
        nameInput.value = window.localStorage.getItem(NAME_STORAGE_KEY) || "";
      } catch (error) {
        /* Abaikan bila penyimpanan browser tidak tersedia. */
      }
      nameInput.addEventListener("input", function () {
        if (nameInput.getAttribute("aria-invalid") === "true") {
          nameInput.removeAttribute("aria-invalid");
          setCommentStatus("", null);
        }
      });
    }

    if (commentInput) {
      commentInput.addEventListener("input", function () {
        if (commentInput.getAttribute("aria-invalid") === "true") {
          commentInput.removeAttribute("aria-invalid");
          setCommentStatus("", null);
        }
      });
    }

    loadComments();
  }
})();
