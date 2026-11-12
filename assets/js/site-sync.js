(function () {
  "use strict";

  var novels = [];
  var visible = [];
  var visibleIds = [];
  var home = {};

  function applyState(data) {
    novels = (data && data.novels) || [];
    visible = novels.filter(function (novel) { return novel.visible !== false; });
    visibleIds = visible.map(function (novel) { return novel.id; });
    home = (data && data.home) || {};

    syncHomeCarousel();
    syncSpotlightArt();
    syncBrowseCatalog();
  }

  function loadLocalState() {
    try {
      if (!window.ConnvelStore) {
        return false;
      }
      if (!window.localStorage.getItem(window.ConnvelStore.STORAGE_KEY)) {
        return false;
      }
      applyState(window.ConnvelStore.load());
      return true;
    } catch (error) {
      return false;
    }
  }

  function startSync() {
    if (!window.fetch) {
      loadLocalState();
      return;
    }

    window.fetch("/api/state", { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Backend tidak tersedia.");
      }
      return response.json();
    }).then(function (payload) {
      applyState(payload && payload.state ? payload.state : payload);
    }).catch(function () {
      loadLocalState();
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function genreTokens(value) {
    return String(value || "").split(",").map(function (item) {
      return slugify(item);
    }).filter(Boolean).join(" ");
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&amp;/g, "dan")
      .replace(/&/g, "dan")
      .replace(/[^a-z0-9]+/g, "");
  }

  function novelById(id) {
    return novels.find(function (novel) { return novel.id === id; }) || null;
  }

  function novelByTitle(title) {
    var target = normalize(title);
    return novels.find(function (novel) { return normalize(novel.title) === target; }) || null;
  }

  function novelHref(novel) {
    return "novel/" + encodeURIComponent(novel.id) + ".html";
  }

  function posterFor(novel) {
    if (!novel || !novel.poster) {
      return "assets/images/hero-reading.jpg";
    }
    if (novel.poster.indexOf("data:") === 0) {
      return novel.poster;
    }
    return novel.poster.replace(/^(\.\.\/)+/, "");
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function statusLabel(novel) {
    return novel.status === "Completed" ? "Tamat" : "Sedang Berjalan";
  }

  function todayISO() {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function updateBookCard(card, novel) {
    if (!novel) {
      return;
    }

    var titleLink = card.querySelector(".book-title a");
    setText(titleLink, novel.title);
    if (titleLink) {
      titleLink.setAttribute("href", novelHref(novel));
    }
    setText(card.querySelector(".book-genre"), novel.genre);
    setText(card.querySelector(".book-author"), "oleh " + novel.author);

    var coverLink = card.querySelector(".book-cover-link");
    if (coverLink) {
      coverLink.setAttribute("href", novelHref(novel));
      coverLink.setAttribute("aria-label", "Baca " + novel.title);
    }

    var coverImage = card.querySelector(".book-cover img");
    var poster = posterFor(novel);
    if (coverImage && coverImage.getAttribute("src") !== poster) {
      coverImage.src = poster;
      coverImage.alt = "Sampul " + novel.title;
    }

    var saveButton = card.querySelector(".book-save");
    if (saveButton) {
      saveButton.setAttribute("aria-label", "Simpan " + novel.title + " ke perpustakaanmu");
    }
  }

  function buildBookCard(novel) {
    var card = document.createElement("article");
    card.className = "book-card";
    card.setAttribute("data-novel-id", novel.id);
    card.innerHTML =
      '<div class="book-cover">' +
      '<a class="book-cover-link" href="' + escapeHtml(novelHref(novel)) + '" aria-label="Baca ' + escapeHtml(novel.title) + '">' +
      '<img src="' + escapeHtml(posterFor(novel)) + '" alt="Sampul ' + escapeHtml(novel.title) + '" width="700" height="1050" loading="lazy">' +
      '<span class="cover-cta" aria-hidden="true">Baca sekarang <svg class="icon"><use href="#icon-arrow-right"/></svg></span>' +
      "</a>" +
      '<button class="book-save" type="button" aria-label="Simpan ' + escapeHtml(novel.title) + ' ke perpustakaanmu" aria-pressed="false">' +
      '<svg class="icon" aria-hidden="true"><use href="#icon-bookmark"/></svg>' +
      "</button>" +
      "</div>" +
      '<div class="book-meta">' +
      '<p class="book-genre">' + escapeHtml(novel.genre) + "</p>" +
      '<h3 class="book-title"><a href="' + escapeHtml(novelHref(novel)) + '">' + escapeHtml(novel.title) + "</a></h3>" +
      '<p class="book-author">oleh ' + escapeHtml(novel.author) + "</p>" +
      "</div>";
    return card;
  }

  function applyBadge(card, id) {
    var coverLink = card.querySelector(".book-cover-link");
    if (!coverLink) {
      return;
    }

    var badge = coverLink.querySelector(".cover-badge");
    var label = "";

    if (id === home.spotlight) {
      label = "Pilihan editor";
    } else if ((home.trending || []).indexOf(id) !== -1) {
      label = "Trending";
    }

    if (label) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "cover-badge";
        coverLink.appendChild(badge);
      }
      badge.textContent = label;
    } else if (badge) {
      badge.remove();
    }
  }

  function syncHomeCarousel() {
    var track = document.getElementById("book-carousel");
    if (!track) {
      return;
    }

    var cards = Array.prototype.slice.call(track.querySelectorAll(".book-card"));
    var existing = {};

    cards.forEach(function (card) {
      var id = card.getAttribute("data-novel-id");
      if (!id) {
        var titleLink = card.querySelector(".book-title");
        var match = titleLink ? novelByTitle(titleLink.textContent) : null;
        id = match ? match.id : "";
        if (id) {
          card.setAttribute("data-novel-id", id);
        }
      }

      if (!id || visibleIds.indexOf(id) === -1) {
        card.remove();
        return;
      }

      existing[id] = card;
      updateBookCard(card, novelById(id));
    });

    var order = (home.latest || []).filter(function (id) {
      return visibleIds.indexOf(id) !== -1;
    });

    if (!order.length) {
      order = Object.keys(existing);
    }

    order.forEach(function (id) {
      var novel = novelById(id);
      if (!novel) {
        return;
      }
      var card = existing[id] || buildBookCard(novel);
      track.appendChild(card);
      applyBadge(card, id);
    });

    cards.forEach(function (card) {
      if (card.parentNode === track && order.indexOf(card.getAttribute("data-novel-id")) === -1) {
        card.remove();
      }
    });
  }

  function syncSpotlightArt() {
    var spotlight = novelById(home.spotlight);
    var front = document.querySelector(".pick-cover-front img");

    if (front && spotlight) {
      front.src = posterFor(spotlight);
      front.alt = spotlight.title + ", pilihan editor minggu ini";
    }

    var lead = document.querySelector(".pick-lead");
    if (lead && spotlight) {
      lead.textContent =
        "Minggu ini, editor kami memilih \u201c" +
        spotlight.title +
        "\u201d karya " +
        spotlight.author +
        ". " +
        (spotlight.synopsis || "Sebuah cerita yang layak dinikmati perlahan.") +
        " Temui novel yang akan dibaca semua orang selanjutnya \u2014 lalu siapkan ruang untuk ceritamu sendiri.";
    }

    var backdrop = document.querySelector(".pick-cover-back img");
    if (!backdrop) {
      return;
    }

    var trending = (home.trending || []).filter(function (id) {
      return visibleIds.indexOf(id) !== -1 && id !== home.spotlight;
    });
    var backdropNovel = novelById(trending[0]) || visible.find(function (novel) {
      return novel.id !== home.spotlight;
    });

    if (backdropNovel) {
      backdrop.src = posterFor(backdropNovel);
      backdrop.alt = "";
    }
  }

  function updateBrowseRow(row, novel) {
    if (!novel) {
      return;
    }

    row.setAttribute("data-title", novel.title);
    row.setAttribute("data-author", novel.author);
    row.setAttribute("data-genre", genreTokens(novel.genre));
    row.setAttribute("data-chapters", String(Number(novel.chapters) || 0));

    setText(row.querySelector(".novel-genre"), novel.genre);
    var titleLink = row.querySelector(".novel-title a");
    setText(titleLink, novel.title);
    if (titleLink) {
      titleLink.setAttribute("href", novelHref(novel));
    }
    setText(row.querySelector(".book-author"), "oleh " + novel.author);

    var synopsis = row.querySelector(".novel-synopsis");
    if (synopsis && novel.synopsis) {
      synopsis.textContent = novel.synopsis;
    }

    setText(row.querySelector(".novel-chapters"), (Number(novel.chapters) || 0) + " Bab");

    var status = row.querySelector(".novel-status");
    if (status) {
      status.textContent = statusLabel(novel);
      status.classList.toggle("is-complete", novel.status === "Completed");
    }

    var coverLink = row.querySelector(".novel-cover");
    if (coverLink) {
      coverLink.setAttribute("href", novelHref(novel));
      coverLink.setAttribute("aria-label", "Baca " + novel.title);
    }

    var coverImage = row.querySelector(".novel-cover img");
    var poster = posterFor(novel);
    if (coverImage && coverImage.getAttribute("src") !== poster) {
      coverImage.src = poster;
      coverImage.alt = "Sampul " + novel.title;
    }

    var action = row.querySelector(".novel-action");
    if (action) {
      action.setAttribute("href", novelHref(novel));
    }
  }

  function buildBrowseRow(novel) {
    var row = document.createElement("article");
    row.className = "novel-row-item";
    row.setAttribute("data-novel-id", novel.id);
    row.setAttribute("data-genre", genreTokens(novel.genre));
    row.setAttribute("data-title", novel.title);
    row.setAttribute("data-author", novel.author);
    row.setAttribute("data-chapters", String(Number(novel.chapters) || 0));
    row.setAttribute("data-popularity", "0");
    row.setAttribute("data-date", todayISO());

    var completed = novel.status === "Completed";
    var synopsis = novel.synopsis || "Sinopsis untuk novel ini belum ditambahkan.";

    row.innerHTML =
      '<a class="novel-cover" href="' + escapeHtml(novelHref(novel)) + '" aria-label="Baca ' + escapeHtml(novel.title) + '">' +
      '<img src="' + escapeHtml(posterFor(novel)) + '" alt="Sampul ' + escapeHtml(novel.title) + '" width="700" height="1050" loading="lazy">' +
      "</a>" +
      '<div class="novel-info">' +
      '<p class="book-genre novel-genre">' + escapeHtml(novel.genre) + "</p>" +
      '<h3 class="novel-title"><a href="' + escapeHtml(novelHref(novel)) + '">' + escapeHtml(novel.title) + "</a></h3>" +
      '<p class="book-author">oleh ' + escapeHtml(novel.author) + "</p>" +
      '<p class="novel-synopsis">' + escapeHtml(synopsis) + "</p>" +
      '<div class="novel-meta">' +
      '<span class="novel-chapters">' + (Number(novel.chapters) || 0) + " Bab</span>" +
      '<span class="stat-divider" aria-hidden="true">&middot;</span>' +
      '<span class="novel-status' + (completed ? " is-complete" : "") + '">' + statusLabel(novel) + "</span>" +
      "</div>" +
      '<a class="btn btn-primary novel-action" href="' + escapeHtml(novelHref(novel)) + '">Buka Novel ' +
      '<svg class="icon" aria-hidden="true"><use href="#icon-arrow-right"/></svg></a>' +
      "</div>";
    return row;
  }

  function syncBrowseCatalog() {
    var list = document.getElementById("novel-list");
    if (!list) {
      return;
    }

    var rows = Array.prototype.slice.call(list.querySelectorAll(".novel-row-item"));
    var existing = {};

    rows.forEach(function (row) {
      var id = row.getAttribute("data-novel-id");
      if (!id) {
        var match = novelByTitle(row.getAttribute("data-title"));
        id = match ? match.id : "";
        if (id) {
          row.setAttribute("data-novel-id", id);
        }
      }

      if (!id || visibleIds.indexOf(id) === -1) {
        row.remove();
        return;
      }

      existing[id] = row;
      updateBrowseRow(row, novelById(id));
    });

    visible.forEach(function (novel) {
      if (!existing[novel.id]) {
        list.appendChild(buildBrowseRow(novel));
      }
    });

    try {
      document.dispatchEvent(new CustomEvent("connvel:catalog-updated"));
    } catch (error) {
      /* Peristiwa kustom hanya bonus; abaikan bila tidak didukung. */
    }
  }

  startSync();
})();
