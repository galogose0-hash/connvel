(function () {
  "use strict";

  var SESSION_KEY = "connvel_admin_session";
  var API_STATE_URL = "/api/state";
  var MAX_LATEST = 6;
  var MAX_TRENDING = 3;
  var MAX_POSTER_SIZE = 1.5 * 1024 * 1024;

  var VIEWS = {
    ringkasan: { label: "Ringkasan", title: "Ringkasan" },
    beranda: { label: "Kelola Beranda", title: "Kelola Beranda" },
    katalog: { label: "Kelola Katalog", title: "Kelola Katalog" },
    novel: { label: "Novel & Bab", title: "Novel & Bab" },
    "kotak-masuk": { label: "Kotak Masuk Penulis", title: "Kotak Masuk Penulis" },
    komentar: { label: "Kelola Komentar", title: "Komentar Pembaca" },
    pengumuman: { label: "Pengumuman", title: "Kelola Pengumuman" }
  };

  var EMPTY_DATA = {
    novels: [],
    chapters: [],
    home: { spotlight: "", latest: [], trending: [] },
    announcements: [],
    submissions: [],
    comments: []
  };
  var DATA = EMPTY_DATA;
  var selectedNovelId = "";
  var currentView = "ringkasan";
  var pendingPoster = "";
  var editingChapterId = "";
  var editingCommentId = "";
  var editingAnnouncementId = "";
  var apiAvailable = false;
  var toastTimer = null;
  var homeStatusTimer = null;
  var novelStatusTimer = null;
  var announcementStatusTimer = null;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function contentToText(value) {
    var content = String(value || "");
    if (!/<\/?(p|blockquote|div|span|em|strong|br)\b/i.test(content)) {
      return content.trim();
    }
    try {
      var doc = new DOMParser().parseFromString(content, "text/html");
      var blocks = Array.prototype.slice.call(doc.body.querySelectorAll("p, .letter-signature, .chapter-continued"));
      if (!blocks.length) {
        return (doc.body.textContent || "").trim();
      }
      return blocks.map(function (block) {
        return (block.textContent || "").replace(/\s+/g, " ").trim();
      }).filter(Boolean).join("\n\n");
    } catch (error) {
      return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  function sortAnnouncements(list) {
    return list.map(function (item, index) {
      return { item: item, index: index };
    }).sort(function (a, b) {
      if (a.item.date === b.item.date) {
        return a.index - b.index;
      }
      if (!a.item.date) {
        return 1;
      }
      if (!b.item.date) {
        return -1;
      }
      return a.item.date < b.item.date ? 1 : -1;
    }).map(function (entry) {
      return entry.item;
    });
  }

  function hydrateAnnouncements(source) {
    var list = Array.isArray(source.announcements) ? source.announcements : [];
    if (!list.length && source.announcement && typeof source.announcement === "object" && source.announcement.title) {
      list = [Object.assign({ id: "ann-1" }, source.announcement)];
    }
    return sortAnnouncements(list.filter(function (item) {
      return item && typeof item === "object" && String(item.title || "").trim();
    }).map(function (item, index) {
      return {
        id: String(item.id || "").trim() || "ann-" + (index + 1),
        title: String(item.title || "").trim(),
        body: String(item.body || "").trim(),
        date: String(item.date || "").slice(0, 10),
        visible: item.visible !== false
      };
    }));
  }

  function hydrateData(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    return {
      novels: Array.isArray(source.novels) ? source.novels : [],
      chapters: Array.isArray(source.chapters) ? source.chapters : [],
      home: Object.assign({ spotlight: "", latest: [], trending: [] }, source.home || {}),
      announcements: hydrateAnnouncements(source),
      submissions: Array.isArray(source.submissions) ? source.submissions : [],
      comments: Array.isArray(source.comments) ? source.comments : []
    };
  }

  function setMode(serverActive) {
    var pill = $("#dash-mode-pill");
    var note = $("#dash-mode-note");
    apiAvailable = serverActive;

    if (!pill || !note) {
      return;
    }

    pill.classList.toggle("is-offline", !serverActive);
    pill.innerHTML = '<span aria-hidden="true"></span> ' + (serverActive ? "Mode server" : "Backend offline");
    note.textContent = serverActive
      ? "Mode server: perubahan tersimpan ke penyimpanan daring (Netlify Blobs atau data/connvel.json saat lokal)."
      : "Mode lokal: backend tidak aktif. Jalankan npm start agar perubahan menulis file HTML.";
  }

  function apiRequest(method, payload) {
    var session = getSession();
    var headers = {};
    if (payload) {
      headers["Content-Type"] = "application/json";
    }
    if (session && session.token) {
      headers["Authorization"] = "Bearer " + session.token;
    }
    return window.fetch(API_STATE_URL, {
      method: method,
      cache: "no-store",
      headers: headers,
      body: payload ? JSON.stringify(payload) : undefined
    }).then(function (response) {
      return response.text().then(function (text) {
        var body = {};
        try {
          body = text ? JSON.parse(text) : {};
        } catch (error) {
          body = {};
        }
        if (!response.ok) {
          var failure = new Error(body.error || "Server mengembalikan status " + response.status + ".");
          failure.statusCode = response.status;
          throw failure;
        }
        return body;
      });
    });
  }

  function loadState() {
    return apiRequest("GET").then(function (payload) {
      DATA = hydrateData(payload.state || payload);
      setMode(true);
      mirrorState();
    }).catch(function (error) {
      if (error && error.statusCode === 401) {
        logout();
        return;
      }
      DATA = hydrateData(window.ConnvelStore ? window.ConnvelStore.load() : EMPTY_DATA);
      setMode(false);
      showToast("Backend belum aktif. Jalankan npm start untuk membuat file HTML.");
      console.warn(error);
    });
  }

  function mirrorState() {
    try {
      if (window.ConnvelStore) {
        window.ConnvelStore.save(DATA);
      }
    } catch (error) {
      /* Salinan browser hanya dipakai sebagai fallback situs publik. */
    }
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function uniqueNovelId(title) {
    var base = slugify(title) || "novel";
    var id = base;
    var index = 2;
    while (DATA.novels.some(function (novel) { return novel.id === id; })) {
      id = base + "-" + index;
      index += 1;
    }
    return id;
  }

  function selectedGenres(container) {
    return $$('input[type="checkbox"]:checked', container).map(function (input) {
      return input.value;
    });
  }

  function setSelectedGenres(container, value) {
    var selected = String(value || "").split(",").map(function (item) {
      return item.trim();
    }).filter(Boolean);

    $$('input[type="checkbox"]', container).forEach(function (input) {
      input.checked = selected.indexOf(input.value) !== -1;
    });
  }

  function joinGenres(values) {
    var seen = {};
    var result = [];
    values.forEach(function (value) {
      var genre = String(value || "").trim();
      if (genre && !seen[genre]) {
        seen[genre] = true;
        result.push(genre);
      }
    });
    return result.join(", ");
  }

  function toDate(value) {
    if (!value) {
      return null;
    }
    var date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(value + "T00:00:00")
      : new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    var date = toDate(value);
    if (!date) {
      return "Belum diatur";
    }
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function formatDateTime(value) {
    var date = toDate(value);
    if (!date) {
      return "Belum diatur";
    }
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function todayISO() {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function novelById(id) {
    return DATA.novels.find(function (novel) { return novel.id === id; }) || null;
  }

  function chaptersFor(novelId) {
    return DATA.chapters
      .filter(function (chapter) { return chapter.novelId === novelId; })
      .slice()
      .sort(function (a, b) { return Number(a.number) - Number(b.number); });
  }

  function currentNovel() {
    return novelById(selectedNovelId);
  }

  function posterSrc(novel) {
    if (!novel || !novel.poster) {
      return "";
    }
    if (novel.poster.indexOf("data:") === 0) {
      return novel.poster;
    }
    return "../" + novel.poster.replace(/^(\.\.\/)+/, "");
  }

  function thumbMarkup(novel, extraClass) {
    var classes = "novel-thumb" + (extraClass ? " " + extraClass : "");
    if (novel && novel.poster) {
      return '<span class="' + classes + '"><img src="' + escapeHtml(posterSrc(novel)) + '" alt=""></span>';
    }
    return '<span class="' + classes + ' novel-thumb--fallback" aria-hidden="true">' +
      escapeHtml((novel && novel.title ? novel.title.charAt(0) : "?").toUpperCase()) +
      "</span>";
  }

  function resetPosterPreview() {
    var preview = $("#poster-preview");
    preview.classList.remove("has-image");
    preview.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#dash-icon-image"/></svg><span>Pilih gambar</span>';
  }

  function showPosterPreview(source) {
    var preview = $("#poster-preview");
    preview.classList.add("has-image");
    preview.innerHTML = '<img src="' + escapeHtml(source) + '" alt="Pratinjau poster">';
  }

  function showToast(message) {
    var toast = $("#dash-toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  function commit(message) {
    if (!apiAvailable) {
      try {
        mirrorState();
        if (message) {
          showToast(message + " (hanya tersimpan di browser)");
        }
        return Promise.resolve(true);
      } catch (error) {
        showToast("Data gagal disimpan. Penyimpanan browser mungkin penuh.");
        return Promise.resolve(false);
      }
    }

    var previousSelection = selectedNovelId;
    return apiRequest("PUT", DATA).then(function (payload) {
      DATA = hydrateData(payload.state || DATA);
      if (selectedNovelId === previousSelection && !novelById(selectedNovelId)) {
        selectedNovelId = DATA.novels.length ? DATA.novels[0].id : "";
      }
      mirrorState();
      if (message) {
        showToast(message);
      }
      return true;
    }).catch(function (error) {
      if (error && error.statusCode === 401) {
        showToast("Sesi kunci admin berakhir. Silakan masuk kembali.");
        window.setTimeout(logout, 1200);
        return false;
      }
      showToast("Gagal menyimpan ke server: " + error.message);
      return false;
    });
  }

  function setStatus(element, message, timerName) {
    element.textContent = message;
    element.classList.add("is-visible");
    if (timerName === "home") {
      window.clearTimeout(homeStatusTimer);
      homeStatusTimer = window.setTimeout(function () {
        element.textContent = "";
        element.classList.remove("is-visible");
      }, 3600);
    }
    if (timerName === "novel") {
      window.clearTimeout(novelStatusTimer);
      novelStatusTimer = window.setTimeout(function () {
        element.textContent = "";
        element.classList.remove("is-visible");
      }, 3600);
    }
    if (timerName === "announcement") {
      window.clearTimeout(announcementStatusTimer);
      announcementStatusTimer = window.setTimeout(function () {
        element.textContent = "";
        element.classList.remove("is-visible");
      }, 3600);
    }
  }

  function getSession() {
    try {
      return JSON.parse(window.sessionStorage.getItem(SESSION_KEY));
    } catch (error) {
      return null;
    }
  }

  function logout() {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("index.html");
  }

  function openSidebar() {
    var sidebar = $("#dash-sidebar");
    var scrim = $("#sidebar-scrim");
    sidebar.classList.add("is-open");
    scrim.hidden = false;
    document.body.classList.add("dash-nav-open");
    $("#sidebar-open").setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    var sidebar = $("#dash-sidebar");
    var scrim = $("#sidebar-scrim");
    sidebar.classList.remove("is-open");
    scrim.hidden = true;
    document.body.classList.remove("dash-nav-open");
    $("#sidebar-open").setAttribute("aria-expanded", "false");
  }

  function setView(view, updateLocation) {
    if (!VIEWS[view]) {
      view = "ringkasan";
    }
    currentView = view;

    $$("[data-view-panel]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-view-panel") !== view;
    });

    $$("[data-view]").forEach(function (button) {
      var active = button.getAttribute("data-view") === view;
      button.classList.toggle("is-active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    $("#current-view-label").textContent = VIEWS[view].label;
    $("#dash-view-title").textContent = VIEWS[view].title;
    document.title = VIEWS[view].label + " - Dashboard Connvel";

    if (updateLocation !== false) {
      try {
        window.history.replaceState(null, "", "#" + view);
      } catch (error) {
        /* Riwayat tidak tersedia pada beberapa konteks file lokal. */
      }
    }

    if (view === "ringkasan") {
      renderSummary();
    } else if (view === "beranda") {
      renderHome();
    } else if (view === "katalog") {
      renderCatalog();
    } else if (view === "novel") {
      renderNovelSelect();
    } else if (view === "kotak-masuk") {
      renderInbox();
    } else if (view === "komentar") {
      renderComments();
    } else if (view === "pengumuman") {
      renderAnnouncement();
    }

    closeSidebar();
  }

  function renderSummary() {
    var visibleNovels = DATA.novels.filter(function (novel) { return novel.visible; }).length;
    var totalChapters = DATA.novels.reduce(function (total, novel) {
      return total + (Number(novel.chapters) || 0);
    }, 0);
    var publishedChapters = DATA.chapters.filter(function (chapter) { return chapter.published; }).length;
    var draftChapters = DATA.chapters.filter(function (chapter) { return !chapter.published; }).length;
    var newSubmissions = DATA.submissions.filter(function (submission) { return submission.status === "baru"; }).length;

    var stats = [
      {
        label: "Total novel",
        value: DATA.novels.length,
        detail: visibleNovels + " tampil di katalog",
        icon: "dash-icon-book"
      },
      {
        label: "Total bab",
        value: totalChapters,
        detail: DATA.chapters.length + " bab tercatat di editor",
        icon: "dash-icon-layers"
      },
      {
        label: "Bab terbit",
        value: publishedChapters,
        detail: draftChapters + " bab masih draf",
        icon: "dash-icon-check"
      },
      {
        label: "Kiriman baru",
        value: newSubmissions,
        detail: DATA.submissions.length + " total di kotak masuk",
        icon: "dash-icon-inbox"
      }
    ];

    $("#stats-grid").innerHTML = stats.map(function (stat) {
      return '<article class="stat-card">' +
        '<span class="stat-icon" aria-hidden="true"><svg class="icon"><use href="#' + stat.icon + '"/></svg></span>' +
        '<p class="stat-label">' + escapeHtml(stat.label) + "</p>" +
        '<strong class="stat-value">' + escapeHtml(stat.value) + "</strong>" +
        '<span class="stat-detail">' + escapeHtml(stat.detail) + "</span>" +
        "</article>";
    }).join("");

    var pending = DATA.chapters
      .filter(function (chapter) { return !chapter.published; })
      .slice()
      .sort(function (a, b) {
        return (toDate(a.date) || new Date(0)) - (toDate(b.date) || new Date(0));
      })
      .slice(0, 5);

    if (!pending.length) {
      $("#pending-chapters").innerHTML = '<li class="mini-empty">Semua bab sudah dirilis. Ruang tunggu sedang tenang.</li>';
    } else {
      $("#pending-chapters").innerHTML = pending.map(function (chapter) {
        var novel = novelById(chapter.novelId);
        return '<li class="mini-item">' +
          '<span class="mini-item-icon" aria-hidden="true"><svg class="icon"><use href="#dash-icon-layers"/></svg></span>' +
          "<div><strong>" + escapeHtml(chapter.title) + "</strong>" +
          "<span>" + escapeHtml(novel ? novel.title : "Novel") + " · Bab " + escapeHtml(chapter.number) + "</span></div>" +
          '<span class="mini-date">' + escapeHtml(formatDate(chapter.date)) + "</span>" +
          "</li>";
      }).join("");
    }

    var recent = DATA.submissions
      .slice()
      .sort(function (a, b) {
        return (toDate(b.date) || new Date(0)) - (toDate(a.date) || new Date(0));
      })
      .slice(0, 3);

    if (!recent.length) {
      $("#recent-submissions").innerHTML = '<li class="mini-empty">Belum ada kiriman penulis.</li>';
    } else {
      $("#recent-submissions").innerHTML = recent.map(function (submission) {
        return '<li class="mini-item">' +
          '<span class="mini-item-icon" aria-hidden="true">' + escapeHtml((submission.name || "?").charAt(0).toUpperCase()) + "</span>" +
          "<div><strong>" + escapeHtml(submission.novelTitle) + "</strong>" +
          "<span>" + escapeHtml(submission.name) + " · " + escapeHtml(formatDate(submission.date)) + "</span></div>" +
          '<span class="status-pill ' + (submission.status === "baru" ? "is-new" : "is-read") + '">' +
          (submission.status === "baru" ? "Baru" : "Dibaca") + "</span>" +
          "</li>";
      }).join("");
    }

    var newCount = newSubmissions;
    var badge = $("#nav-inbox-count");
    badge.textContent = newCount > 9 ? "9+" : String(newCount);
    badge.hidden = newCount === 0;
  }

  function renderHome() {
    var visibleNovels = DATA.novels.filter(function (novel) { return novel.visible; });
    var visibleIds = visibleNovels.map(function (novel) { return novel.id; });

    var latest = DATA.home.latest.filter(function (id) {
      return visibleIds.indexOf(id) !== -1;
    }).slice(0, MAX_LATEST);

    var trending = DATA.home.trending.filter(function (id) {
      return visibleIds.indexOf(id) !== -1;
    }).slice(0, MAX_TRENDING);

    renderHomeChoices($("#latest-options"), latest, MAX_LATEST, "latest");
    renderHomeChoices($("#trending-options"), trending, MAX_TRENDING, "trending");

    var spotlight = DATA.home.spotlight;
    if (visibleIds.indexOf(spotlight) === -1) {
      spotlight = visibleIds[0] || "";
    }

    $("#spotlight-select").innerHTML = visibleNovels.length
      ? visibleNovels.map(function (novel) {
        return '<option value="' + escapeHtml(novel.id) + '"' +
          (novel.id === spotlight ? " selected" : "") + ">" +
          escapeHtml(novel.title) + "</option>";
      }).join("")
      : '<option value="">Belum ada novel yang tampil</option>';

    $("#home-status").textContent = "";
    $("#home-status").classList.remove("is-visible");
  }

  function renderHomeChoices(container, selectedIds, max, group) {
    var visibleNovels = DATA.novels.filter(function (novel) { return novel.visible; });
    var selected = selectedIds.slice(0, max);

    if (!visibleNovels.length) {
      container.innerHTML = '<p class="empty-inline">Tampilkan setidaknya satu novel di katalog terlebih dahulu.</p>';
      return;
    }

    container.innerHTML = visibleNovels.map(function (novel) {
      var checked = selected.indexOf(novel.id) !== -1;
      return '<label class="novel-check' + (checked ? " is-selected" : "") + '">' +
        '<input type="checkbox" value="' + escapeHtml(novel.id) + '" data-home-group="' + group + '"' +
        (checked ? " checked" : "") + ">" +
        '<span class="novel-check-body">' +
        thumbMarkup(novel, "novel-thumb--check") +
        '<span class="novel-check-copy"><strong>' + escapeHtml(novel.title) + "</strong>" +
        "<span>" + escapeHtml(novel.author) + " · " + escapeHtml(novel.genre) + "</span></span>" +
        '<span class="novel-check-mark" aria-hidden="true"><svg class="icon"><use href="#dash-icon-check"/></svg></span>' +
        "</span>" +
        "</label>";
    }).join("");

    syncHomeLimit(container, group === "latest" ? MAX_LATEST : MAX_TRENDING);
  }

  function syncHomeLimit(container, max) {
    var checked = container.querySelectorAll('input[type="checkbox"]:checked').length;
    var group = container.getAttribute("id") === "latest-options" ? "latest" : "trending";
    var limitReached = checked >= max;
    var counter = group === "latest" ? $("#latest-count") : $("#trending-count");

    $$("input[type='checkbox']", container).forEach(function (input) {
      input.disabled = !input.checked && limitReached;
      input.closest(".novel-check").classList.toggle("is-selected", input.checked);
    });

    counter.textContent = checked + " / " + max;
    counter.classList.toggle("is-full", limitReached);
  }

  function handleHomeChoiceChange(event) {
    var input = event.target.closest('input[data-home-group]');
    if (!input) {
      return;
    }
    var container = input.closest(".novel-check-grid");
    var group = input.getAttribute("data-home-group");
    var max = group === "latest" ? MAX_LATEST : MAX_TRENDING;
    var checked = container.querySelectorAll('input[type="checkbox"]:checked').length;

    if (checked > max) {
      input.checked = false;
      showToast("Maksimal " + max + " novel untuk bagian ini.");
    }

    syncHomeLimit(container, max);
  }

  function renderCatalog() {
    var query = $("#catalog-search").value.trim().toLowerCase();
    var novels = DATA.novels.filter(function (novel) {
      if (!query) {
        return true;
      }
      return [novel.title, novel.author, novel.genre, novel.synopsis].join(" ").toLowerCase().indexOf(query) !== -1;
    });

    $("#novel-table-body").innerHTML = novels.map(function (novel) {
      return "<tr>" +
        '<td><div class="novel-cell">' +
        thumbMarkup(novel) +
        '<div class="novel-cell-copy"><strong>' + escapeHtml(novel.title) + "</strong>" +
        "<span>" + escapeHtml(novel.author) + "</span></div>" +
        "</div></td>" +
        '<td><span class="genre-pill">' + escapeHtml(novel.genre) + "</span></td>" +
        "<td>" + escapeHtml(novel.chapters) + " bab</td>" +
        '<td><span class="status-pill ' + (novel.visible ? "is-live" : "is-hidden") + '">' +
        (novel.visible ? "Tampil" : "Disembunyikan") + "</span></td>" +
        '<td><div class="row-actions">' +
        '<button class="table-action" type="button" data-toggle-novel="' + escapeHtml(novel.id) + '">' +
        (novel.visible ? "Sembunyikan" : "Tampilkan") + "</button>" +
        '<button class="icon-button icon-button--danger" type="button" data-delete-novel="' + escapeHtml(novel.id) + '" aria-label="Hapus ' + escapeHtml(novel.title) + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#dash-icon-trash"/></svg></button>' +
        "</div></td>" +
        "</tr>";
    }).join("");

    $("#catalog-empty").hidden = novels.length !== 0;
  }

  function renderNovelSelect() {
    var select = $("#novel-select");
    if (!DATA.novels.length) {
      selectedNovelId = "";
      select.innerHTML = '<option value="">Belum ada novel</option>';
      select.disabled = true;
      renderNovelEditor();
      return;
    }

    select.disabled = false;
    if (!novelById(selectedNovelId)) {
      selectedNovelId = DATA.novels[0].id;
    }

    select.innerHTML = DATA.novels.map(function (novel) {
      return '<option value="' + escapeHtml(novel.id) + '">' +
        escapeHtml(novel.title) + (novel.visible ? "" : " (disembunyikan)") + "</option>";
    }).join("");
    select.value = selectedNovelId;

    renderNovelEditor();
  }

  function renderNovelEditor() {
    var novel = currentNovel();
    var form = $("#novel-detail-form");
    var controls = $$("input, select, textarea, button", form);

    if (!novel) {
      controls.forEach(function (control) { control.disabled = true; });
      $("#novel-title").value = "";
      $("#novel-author").value = "";
      setSelectedGenres($("#novel-genre"), "Fantasi");
      $("#novel-status").value = "Ongoing";
      $("#novel-type").value = "Novel";
      $("#novel-chapters").value = "";
      $("#novel-synopsis").value = "";
      $("#chapter-subtitle").textContent = "Tambahkan novel terlebih dahulu untuk mengelola bab.";
      $("#chapter-table-body").innerHTML = "";
      $("#chapter-empty").hidden = false;
      $("#chapter-empty").textContent = "Belum ada novel di katalog.";
      $("#add-chapter-button").disabled = true;
      $("#release-preview").innerHTML = '<p class="empty-inline">Belum ada alur baca untuk ditampilkan.</p>';
      return;
    }

    controls.forEach(function (control) { control.disabled = false; });
    $("#novel-title").value = novel.title;
    $("#novel-author").value = novel.author;
    setSelectedGenres($("#novel-genre"), novel.genre);
    $("#novel-status").value = novel.status || "Ongoing";
    $("#novel-type").value = novel.type || "Novel";
    $("#novel-chapters").value = novel.chapters || 0;
    $("#novel-synopsis").value = novel.synopsis || "";
    $("#novel-status-message").textContent = "";
    $("#chapter-subtitle").textContent = "Bab untuk " + novel.title + ".";
    $("#add-chapter-button").disabled = false;

    renderChapterTable();
    renderReleasePreview();
  }

  function renderChapterTable() {
    var novel = currentNovel();
    var chapters = novel ? chaptersFor(novel.id).sort(function (a, b) {
      return Number(b.number) - Number(a.number);
    }) : [];

    if (!novel || !chapters.length) {
      $("#chapter-table-body").innerHTML = "";
      $("#chapter-empty").hidden = false;
      $("#chapter-empty").textContent = novel
        ? "Belum ada bab untuk novel ini. Tambahkan bab pertama."
        : "Belum ada novel di katalog.";
      return;
    }

    $("#chapter-empty").hidden = true;
    $("#chapter-table-body").innerHTML = chapters.map(function (chapter) {
      var excerpt = contentToText(chapter.content).replace(/\s+/g, " ").trim();
      if (excerpt.length > 90) {
        excerpt = excerpt.slice(0, 90) + "...";
      }
      return "<tr>" +
        '<td><span class="chapter-number">Bab ' + escapeHtml(chapter.number) + "</span></td>" +
        '<td><div class="chapter-cell"><strong>' + escapeHtml(chapter.title) + "</strong>" +
        '<span>' + escapeHtml(excerpt || "Belum ada isi naskah.") + "</span></div></td>" +
        "<td>" + escapeHtml(formatDate(chapter.date)) + "</td>" +
        '<td><label class="switch-field switch-field--table">' +
        '<span class="switch">' +
        '<input type="checkbox" data-chapter-toggle="' + escapeHtml(chapter.id) + '"' +
        (chapter.published ? " checked" : "") + ">" +
        '<span class="switch-track" aria-hidden="true"></span>' +
        "</span>" +
        '<span class="switch-state ' + (chapter.published ? "is-live" : "is-draft") + '">' +
        (chapter.published ? "Terbit" : "Draf") + "</span>" +
        "</label></td>" +
        '<td><div class="row-actions">' +
        '<button class="icon-button" type="button" data-edit-chapter="' + escapeHtml(chapter.id) + '" aria-label="Edit naskah bab ' + escapeHtml(chapter.number) + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#dash-icon-edit"/></svg></button>' +
        '<button class="icon-button icon-button--danger" type="button" data-delete-chapter="' + escapeHtml(chapter.id) + '" aria-label="Hapus bab ' + escapeHtml(chapter.number) + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#dash-icon-trash"/></svg></button>' +
        "</div></td>" +
        "</tr>";
    }).join("");
  }

  function renderReleasePreview() {
    var novel = currentNovel();
    var container = $("#release-preview");

    if (!novel) {
      container.innerHTML = '<p class="empty-inline">Belum ada alur baca untuk ditampilkan.</p>';
      return;
    }

    var chapters = chaptersFor(novel.id);
    if (!chapters.length) {
      container.innerHTML = '<p class="empty-inline">Belum ada bab. Tambahkan bab untuk melihat alur rilis.</p>';
      return;
    }

    var firstPublished = chapters.find(function (chapter) { return chapter.published; }) || chapters[0];
    var next = chapters.find(function (chapter) {
      return Number(chapter.number) === Number(firstPublished.number) + 1;
    });
    var unlocked = Boolean(next && next.published);

    container.innerHTML =
      '<p class="release-preview-label">Pratinjau alur dari bab terbit pertama</p>' +
      '<div class="release-flow">' +
      '<div class="release-node">' +
      '<span class="release-node-label">Bab ' + escapeHtml(firstPublished.number) + "</span>" +
      "<strong>" + escapeHtml(firstPublished.title) + "</strong>" +
      '<span class="status-pill ' + (firstPublished.published ? "is-live" : "is-draft") + '">' +
      (firstPublished.published ? "Terbit" : "Draf") + "</span>" +
      "</div>" +
      '<span class="release-arrow" aria-hidden="true">→</span>' +
      '<div class="release-node">' +
      '<span class="release-node-label">' + (next ? "Bab " + escapeHtml(next.number) : "Belum ada") + "</span>" +
      "<strong>" + escapeHtml(next ? next.title : "Bab berikutnya") + "</strong>" +
      '<span class="status-pill ' + (next ? (next.published ? "is-live" : "is-draft") : "is-hidden") + '">' +
      (next ? (next.published ? "Terbit" : "Draf") : "Belum dibuat") + "</span>" +
      "</div>" +
      "</div>" +
      '<p class="release-verdict ' + (unlocked ? "is-open" : "is-locked") + '">' +
      (unlocked
        ? '<svg class="icon" aria-hidden="true"><use href="#dash-icon-check"/></svg> Tombol Selanjutnya akan aktif di halaman baca.'
        : '<svg class="icon" aria-hidden="true"><use href="#dash-icon-close"/></svg> Tombol Selanjutnya tetap nonaktif sampai bab tujuan dirilis.') +
      "</p>";
  }

  function renderInbox() {
    var filter = $("#submission-filter").value;
    var submissions = DATA.submissions.slice().sort(function (a, b) {
      return (toDate(b.date) || new Date(0)) - (toDate(a.date) || new Date(0));
    });

    if (filter !== "semua") {
      submissions = submissions.filter(function (submission) {
        return submission.status === filter;
      });
    }

    $("#submission-list").innerHTML = submissions.map(function (submission) {
      var isNew = submission.status === "baru";
      var mailSubject = encodeURIComponent("Naskah " + submission.novelTitle + " - Connvel");
      return '<article class="submission-card' + (isNew ? " is-new" : "") + '">' +
        '<div class="submission-head">' +
        '<div class="submission-title">' +
        '<span class="status-pill ' + (isNew ? "is-new" : "is-read") + '">' + (isNew ? "Baru" : "Dibaca") + "</span>" +
        "<h3>" + escapeHtml(submission.novelTitle) + "</h3>" +
        "<p>" + escapeHtml(submission.chapter) + "</p>" +
        "</div>" +
        '<time datetime="' + escapeHtml(submission.date) + '">' + escapeHtml(formatDateTime(submission.date)) + "</time>" +
        "</div>" +
        '<div class="submission-author">' +
        '<span class="submission-avatar" aria-hidden="true">' + escapeHtml((submission.name || "?").charAt(0).toUpperCase()) + "</span>" +
        "<div><strong>" + escapeHtml(submission.name) + "</strong>" +
        "<span>" + escapeHtml(submission.email) + " · " + escapeHtml(submission.phone) + "</span></div>" +
        "</div>" +
        '<p class="submission-message">' + escapeHtml(submission.message) + "</p>" +
        '<div class="submission-actions">' +
        (isNew
          ? '<button class="btn btn-primary btn-small" type="button" data-mark-submission="' + escapeHtml(submission.id) + '">' +
            '<svg class="icon" aria-hidden="true"><use href="#dash-icon-check"/></svg> Tandai Dibaca</button>'
          : '<span class="submission-read-note"><svg class="icon" aria-hidden="true"><use href="#dash-icon-check"/></svg> Sudah ditinjau</span>') +
        '<a class="btn btn-outline btn-small" href="mailto:' + escapeHtml(submission.email) + "?subject=" + mailSubject + '">Balas Email</a>' +
        '<button class="table-action table-action--danger" type="button" data-delete-submission="' + escapeHtml(submission.id) + '">Hapus</button>' +
        "</div>" +
        "</article>";
    }).join("");

    $("#submission-empty").hidden = submissions.length !== 0;
  }

  function commentsFor(filterId) {
    var comments = DATA.comments.slice().sort(function (a, b) {
      return (toDate(b.date) || new Date(0)) - (toDate(a.date) || new Date(0));
    });
    if (filterId && filterId !== "semua") {
      comments = comments.filter(function (comment) {
        return comment.novelId === filterId;
      });
    }
    return comments;
  }

  function renderComments() {
    var filterSelect = $("#comment-filter");
    var current = filterSelect.value;
    var known = DATA.novels.some(function (novel) { return novel.id === current; });

    filterSelect.innerHTML = ['<option value="semua">Semua novel</option>'].concat(
      DATA.novels.map(function (novel) {
        return '<option value="' + escapeHtml(novel.id) + '">' + escapeHtml(novel.title) + "</option>";
      })
    ).join("");
    filterSelect.value = known ? current : "semua";

    var comments = commentsFor(filterSelect.value);

    $("#dash-comment-list").innerHTML = comments.map(function (comment) {
      var novel = novelById(comment.novelId);
      return '<article class="submission-card">' +
        '<div class="submission-head">' +
        '<div class="submission-title">' +
        "<h3>" + escapeHtml(comment.name) + "</h3>" +
        "<p>" + escapeHtml(novel ? novel.title : "Novel") + "</p>" +
        "</div>" +
        '<time datetime="' + escapeHtml(comment.date) + '">' + escapeHtml(formatDateTime(comment.date)) + "</time>" +
        "</div>" +
        '<p class="submission-message">' + escapeHtml(comment.message) + "</p>" +
        '<div class="submission-actions">' +
        '<button class="btn btn-outline btn-small" type="button" data-edit-comment="' + escapeHtml(comment.id) + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#dash-icon-edit"/></svg> Edit</button>' +
        '<button class="table-action table-action--danger" type="button" data-delete-comment="' + escapeHtml(comment.id) + '">Hapus</button>' +
        "</div>" +
        "</article>";
    }).join("");

    $("#comment-empty").hidden = comments.length !== 0;
  }

  function openCommentEditor(comment) {
    var novel = novelById(comment.novelId);
    editingCommentId = comment.id;

    $("#comment-editor-subtitle").textContent =
      (novel ? novel.title : "Novel") + " · dikirim " + formatDateTime(comment.date);
    $("#comment-editor-name").value = comment.name || "";
    $("#comment-editor-message").value = comment.message || "";
    $("#comment-form-error").textContent = "";
    $("#comment-form-error").classList.remove("is-visible");

    openDialog($("#comment-dialog"));
    window.setTimeout(function () { $("#comment-editor-name").focus(); }, 30);
  }

  function resetCommentEditor() {
    editingCommentId = "";
    $("#comment-editor-form").reset();
    $("#comment-form-error").textContent = "";
    $("#comment-form-error").classList.remove("is-visible");
  }

  function announcementById(id) {
    return (DATA.announcements || []).find(function (item) {
      return item.id === id;
    }) || null;
  }

  function renderAnnouncementList() {
    var list = sortAnnouncements(DATA.announcements || []);

    $("#announcement-list").innerHTML = list.map(function (item) {
      var isVisible = item.visible !== false;
      return '<article class="submission-card' + (isVisible ? " is-new" : "") + '">' +
        '<div class="submission-head">' +
        '<div class="submission-title">' +
        '<span class="status-pill ' + (isVisible ? "is-new" : "is-read") + '">' + (isVisible ? "Tampil" : "Disembunyikan") + "</span>" +
        "<h3>" + escapeHtml(item.title) + "</h3>" +
        "</div>" +
        '<time datetime="' + escapeHtml(item.date) + '">' + escapeHtml(formatDate(item.date) || "Tanpa tanggal") + "</time>" +
        "</div>" +
        '<p class="submission-message">' + escapeHtml(item.body) + "</p>" +
        '<div class="submission-actions">' +
        '<button class="btn btn-outline btn-small" type="button" data-edit-announcement="' + escapeHtml(item.id) + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#dash-icon-edit"/></svg> Edit</button>' +
        '<button class="table-action table-action--danger" type="button" data-delete-announcement="' + escapeHtml(item.id) + '">Hapus</button>' +
        "</div>" +
        "</article>";
    }).join("");

    $("#announcement-empty").hidden = list.length !== 0;
  }

  function fillAnnouncementForm(item) {
    editingAnnouncementId = item.id;
    $("#announcement-title").value = item.title || "";
    $("#announcement-date").value = item.date || todayISO();
    $("#announcement-body").value = item.body || "";
    $("#announcement-visible").checked = item.visible !== false;
    $("#announcement-editor-kicker").textContent = "Sunting pengumuman";
    $("#announcement-editor-title").textContent = "Perbarui Kabar";
    $("#announcement-submit-label").textContent = "Simpan Perubahan";
    $("#announcement-cancel").hidden = false;
  }

  function resetAnnouncementForm() {
    editingAnnouncementId = "";
    $("#announcement-form").reset();
    $("#announcement-date").value = todayISO();
    $("#announcement-visible").checked = true;
    $("#announcement-editor-kicker").textContent = "Pengumuman baru";
    $("#announcement-editor-title").textContent = "Kabar untuk Pembaca";
    $("#announcement-submit-label").textContent = "Tambah Pengumuman";
    $("#announcement-cancel").hidden = true;
  }

  function renderAnnouncement() {
    renderAnnouncementList();
    var editing = announcementById(editingAnnouncementId);
    if (editing) {
      fillAnnouncementForm(editing);
    } else {
      resetAnnouncementForm();
    }
  }

  function renderAll() {
    renderSummary();
    renderHome();
    renderCatalog();
    renderNovelSelect();
    renderInbox();
    renderComments();
    renderAnnouncement();
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function resetNovelForm() {
    $("#novel-form").reset();
    $("#new-novel-type").value = "Novel";
    $("#new-novel-chapters").value = "0";
    $("#novel-form-error").textContent = "";
    $("#novel-form-error").classList.remove("is-visible");
    pendingPoster = "";
    $("#new-novel-poster").value = "";
    resetPosterPreview();
  }

  function resetChapterForm() {
    var novel = currentNovel();
    var chapters = novel ? chaptersFor(novel.id) : [];
    var maxNumber = chapters.reduce(function (max, chapter) {
      return Math.max(max, Number(chapter.number) || 0);
    }, 0);

    $("#chapter-form").reset();
    $("#new-chapter-number").value = String(maxNumber + 1);
    $("#new-chapter-date").value = todayISO();
    $("#chapter-form-error").textContent = "";
    $("#chapter-form-error").classList.remove("is-visible");
    $("#chapter-dialog-title").textContent = novel ? "Tambah Bab - " + novel.title : "Tambah Bab";
  }

  function openChapterEditor(chapter) {
    var novel = novelById(chapter.novelId);
    editingChapterId = chapter.id;

    $("#chapter-editor-dialog-title").textContent = "Edit Naskah - Bab " + chapter.number;
    $("#chapter-editor-subtitle").textContent = (novel ? novel.title : "Novel") + " · " + chapter.title;
    $("#chapter-editor-title-field").value = chapter.title;
    $("#chapter-editor-date").value = chapter.date || "";
    $("#chapter-editor-content").value = contentToText(chapter.content);
    $("#chapter-editor-published").checked = Boolean(chapter.published);
    $("#chapter-editor-error").textContent = "";
    $("#chapter-editor-error").classList.remove("is-visible");

    openDialog($("#chapter-editor-dialog"));
    window.setTimeout(function () { $("#chapter-editor-content").focus(); }, 30);
  }

  function resetChapterEditor() {
    editingChapterId = "";
    $("#chapter-editor-form").reset();
    $("#chapter-editor-error").textContent = "";
    $("#chapter-editor-error").classList.remove("is-visible");
  }

  function initEvents() {
    $$("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        setView(button.getAttribute("data-view"));
      });
    });

    document.addEventListener("click", function (event) {
      var viewLink = event.target.closest("[data-view-link]");
      if (viewLink) {
        event.preventDefault();
        setView(viewLink.getAttribute("data-view-link"));
      }
    });

    $("#logout-button").addEventListener("click", logout);

    $("#sidebar-open").addEventListener("click", openSidebar);
    $("#sidebar-close").addEventListener("click", closeSidebar);
    $("#sidebar-scrim").addEventListener("click", closeSidebar);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1024) {
        closeSidebar();
      }
    });

    window.addEventListener("hashchange", function () {
      var view = window.location.hash.replace("#", "");
      if (VIEWS[view] && view !== currentView) {
        setView(view, false);
      }
    });

    $("#latest-options").addEventListener("change", handleHomeChoiceChange);
    $("#trending-options").addEventListener("change", handleHomeChoiceChange);

    $("#home-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var latest = $$('#latest-options input[type="checkbox"]:checked').map(function (input) {
        return input.value;
      });
      var trending = $$('#trending-options input[type="checkbox"]:checked').map(function (input) {
        return input.value;
      });
      var spotlight = $("#spotlight-select").value;

      if (!latest.length) {
        setStatus($("#home-status"), "Pilih minimal satu novel untuk Rilisan Terbaru.", "home");
        return;
      }
      if (!trending.length) {
        setStatus($("#home-status"), "Pilih minimal satu novel untuk Trending.", "home");
        return;
      }
      if (!spotlight) {
        setStatus($("#home-status"), "Pilih novel sorotan utama.", "home");
        return;
      }

      var previousHome = {
        latest: DATA.home.latest.slice(),
        trending: DATA.home.trending.slice(),
        spotlight: DATA.home.spotlight
      };

      DATA.home.latest = latest;
      DATA.home.trending = trending;
      DATA.home.spotlight = spotlight;

      if (await commit("Pengaturan beranda tersimpan.")) {
        setStatus($("#home-status"), "Pengaturan beranda tersimpan.", "home");
        renderSummary();
      } else {
        DATA.home = previousHome;
      }
    });

    $("#announcement-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var title = $("#announcement-title").value.trim();
      var date = $("#announcement-date").value;
      var body = $("#announcement-body").value.trim();
      var visible = $("#announcement-visible").checked;

      if (!title) {
        setStatus($("#announcement-status"), "Judul pengumuman wajib diisi.", "announcement");
        $("#announcement-title").focus();
        return;
      }
      if (!date) {
        setStatus($("#announcement-status"), "Tanggal pengumuman wajib diisi.", "announcement");
        $("#announcement-date").focus();
        return;
      }
      if (!body) {
        setStatus($("#announcement-status"), "Isi pengumuman wajib diisi.", "announcement");
        $("#announcement-body").focus();
        return;
      }

      var previousAnnouncements = DATA.announcements.map(function (item) {
        return Object.assign({}, item);
      });
      var target = announcementById(editingAnnouncementId);
      var message;

      if (target) {
        target.title = title;
        target.body = body;
        target.date = date;
        target.visible = visible;
        message = "Pengumuman diperbarui dan tersinkron ke halaman publik.";
      } else {
        DATA.announcements.unshift({
          id: "ann-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
          title: title,
          body: body,
          date: date,
          visible: visible
        });
        message = "Pengumuman ditambahkan dan tersinkron ke halaman publik.";
      }

      if (await commit(message)) {
        editingAnnouncementId = "";
        setStatus($("#announcement-status"), message, "announcement");
        renderAnnouncement();
      } else {
        DATA.announcements = previousAnnouncements;
        renderAnnouncement();
      }
    });

    $("#announcement-list").addEventListener("click", async function (event) {
      var editButton = event.target.closest("[data-edit-announcement]");
      if (editButton) {
        var announcement = announcementById(editButton.getAttribute("data-edit-announcement"));
        if (announcement) {
          fillAnnouncementForm(announcement);
          $("#announcement-form").scrollIntoView({ behavior: "smooth", block: "start" });
          window.setTimeout(function () {
            $("#announcement-title").focus();
          }, 260);
        }
        return;
      }

      var remove = event.target.closest("[data-delete-announcement]");
      if (!remove) {
        return;
      }
      var targetAnnouncement = announcementById(remove.getAttribute("data-delete-announcement"));
      if (!targetAnnouncement) {
        return;
      }
      if (!window.confirm('Hapus pengumuman "' + targetAnnouncement.title + '"?')) {
        return;
      }

      var previousAnnouncements = DATA.announcements.map(function (item) {
        return Object.assign({}, item);
      });
      DATA.announcements = DATA.announcements.filter(function (item) {
        return item.id !== targetAnnouncement.id;
      });

      if (await commit("Pengumuman dihapus.")) {
        if (editingAnnouncementId === targetAnnouncement.id) {
          editingAnnouncementId = "";
        }
        renderAnnouncement();
      } else {
        DATA.announcements = previousAnnouncements;
        renderAnnouncement();
      }
    });

    $("#announcement-cancel").addEventListener("click", function () {
      resetAnnouncementForm();
      $("#announcement-title").focus();
    });

    $("#catalog-search").addEventListener("input", renderCatalog);

    $("#add-novel-button").addEventListener("click", function () {
      resetNovelForm();
      openDialog($("#novel-dialog"));
      window.setTimeout(function () { $("#new-novel-title").focus(); }, 30);
    });

    $$("[data-close-dialog]").forEach(function (button) {
      button.addEventListener("click", function () {
        closeDialog(button.closest("dialog"));
      });
    });

    $$(".dash-dialog").forEach(function (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) {
          closeDialog(dialog);
        }
      });
    });

    $("#new-novel-poster").addEventListener("change", function () {
      var file = this.files && this.files[0];
      var error = $("#novel-form-error");
      error.textContent = "";
      error.classList.remove("is-visible");

      if (!file) {
        pendingPoster = "";
        resetPosterPreview();
        return;
      }

      if (file.type.indexOf("image/") !== 0) {
        error.textContent = "Berkas poster harus berupa gambar.";
        error.classList.add("is-visible");
        this.value = "";
        return;
      }

      if (file.size > MAX_POSTER_SIZE) {
        error.textContent = "Ukuran poster maksimal 1,5 MB agar unggahan tetap ringan.";
        error.classList.add("is-visible");
        this.value = "";
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        pendingPoster = reader.result;
        showPosterPreview(reader.result);
      };
      reader.onerror = function () {
        error.textContent = "Poster gagal dibaca. Coba gambar lain.";
        error.classList.add("is-visible");
      };
      reader.readAsDataURL(file);
    });

    $("#novel-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var title = $("#new-novel-title").value.trim();
      var author = $("#new-novel-author").value.trim();
      var genre = joinGenres(selectedGenres($("#new-novel-genre")));
      var error = $("#novel-form-error");

      if (!title || !author) {
        error.textContent = "Judul dan penulis wajib diisi.";
        error.classList.add("is-visible");
        (!title ? $("#new-novel-title") : $("#new-novel-author")).focus();
        return;
      }

      if (!genre) {
        error.textContent = "Pilih minimal satu genre.";
        error.classList.add("is-visible");
        return;
      }

      var novel = {
        id: uniqueNovelId(title),
        title: title,
        author: author,
        genre: genre,
        type: $("#new-novel-type").value,
        status: $("#new-novel-status").value,
        chapters: Math.max(0, parseInt($("#new-novel-chapters").value, 10) || 0),
        visible: true,
        poster: pendingPoster,
        synopsis: $("#new-novel-synopsis").value.trim()
      };

      DATA.novels.unshift(novel);
      var previousLatest = DATA.home.latest.slice();
      DATA.home.latest.unshift(novel.id);
      DATA.home.latest = DATA.home.latest.slice(0, MAX_LATEST);
      selectedNovelId = novel.id;

      if (!await commit('Novel "' + novel.title + '" ditambahkan.')) {
        DATA.novels.shift();
        DATA.home.latest = previousLatest;
        selectedNovelId = DATA.novels.length ? DATA.novels[0].id : "";
        return;
      }

      closeDialog($("#novel-dialog"));
      renderAll();
      setView("katalog", false);
    });

    $("#novel-select").addEventListener("change", function () {
      selectedNovelId = this.value;
      renderNovelEditor();
    });

    $("#novel-detail-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var novel = currentNovel();
      if (!novel) {
        return;
      }

      var title = $("#novel-title").value.trim();
      var author = $("#novel-author").value.trim();
      var genre = joinGenres(selectedGenres($("#novel-genre")));
      if (!title || !author) {
        setStatus($("#novel-status-message"), "Judul dan penulis wajib diisi.", "novel");
        (!title ? $("#novel-title") : $("#novel-author")).focus();
        return;
      }

      if (!genre) {
        setStatus($("#novel-status-message"), "Pilih minimal satu genre.", "novel");
        return;
      }

      var previousNovel = {
        title: novel.title,
        author: novel.author,
        genre: novel.genre,
        type: novel.type,
        status: novel.status,
        chapters: novel.chapters,
        synopsis: novel.synopsis
      };

      novel.title = title;
      novel.author = author;
      novel.genre = genre;
      novel.type = $("#novel-type").value;
      novel.status = $("#novel-status").value;
      novel.chapters = Math.max(0, parseInt($("#novel-chapters").value, 10) || 0);
      novel.synopsis = $("#novel-synopsis").value.trim();

      if (await commit("Detail novel tersimpan.")) {
        renderAll();
        setStatus($("#novel-status-message"), "Detail novel tersimpan.", "novel");
      } else {
        Object.assign(novel, previousNovel);
      }
    });

    $("#add-chapter-button").addEventListener("click", function () {
      if (!currentNovel()) {
        showToast("Tambahkan novel terlebih dahulu.");
        return;
      }
      resetChapterForm();
      openDialog($("#chapter-dialog"));
      window.setTimeout(function () { $("#new-chapter-title").focus(); }, 30);
    });

    $("#chapter-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var novel = currentNovel();
      if (!novel) {
        return;
      }

      var number = parseInt($("#new-chapter-number").value, 10);
      var title = $("#new-chapter-title").value.trim();
      var date = $("#new-chapter-date").value;
      var error = $("#chapter-form-error");

      if (!number || number < 1) {
        error.textContent = "Nomor bab harus berupa angka lebih dari 0.";
        error.classList.add("is-visible");
        $("#new-chapter-number").focus();
        return;
      }
      if (!title) {
        error.textContent = "Judul bab wajib diisi.";
        error.classList.add("is-visible");
        $("#new-chapter-title").focus();
        return;
      }
      if (!date) {
        error.textContent = "Tanggal rilis wajib diisi.";
        error.classList.add("is-visible");
        $("#new-chapter-date").focus();
        return;
      }
      if (DATA.chapters.some(function (chapter) {
        return chapter.novelId === novel.id && Number(chapter.number) === number;
      })) {
        error.textContent = "Nomor bab ini sudah dipakai. Gunakan nomor lain.";
        error.classList.add("is-visible");
        $("#new-chapter-number").focus();
        return;
      }

      var chapter = {
        id: novel.id + "-bab-" + number,
        novelId: novel.id,
        number: number,
        title: title,
        date: date,
        published: $("#new-chapter-published").checked,
        content: $("#new-chapter-content").value.trim()
      };

      DATA.chapters.push(chapter);
      novel.chapters = Math.max(Number(novel.chapters) || 0, number);

      if (!await commit("Bab " + number + " ditambahkan.")) {
        DATA.chapters.pop();
        return;
      }

      closeDialog($("#chapter-dialog"));
      renderChapterTable();
      renderReleasePreview();
      renderSummary();
    });

    $("#chapter-editor-dialog").addEventListener("close", resetChapterEditor);

    $("#chapter-editor-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var chapter = DATA.chapters.find(function (item) {
        return item.id === editingChapterId;
      });
      var error = $("#chapter-editor-error");
      if (!chapter) {
        error.textContent = "Bab tidak ditemukan. Muat ulang dashboard.";
        error.classList.add("is-visible");
        return;
      }

      var title = $("#chapter-editor-title-field").value.trim();
      var date = $("#chapter-editor-date").value;
      if (!title) {
        error.textContent = "Judul bab wajib diisi.";
        error.classList.add("is-visible");
        $("#chapter-editor-title-field").focus();
        return;
      }
      if (!date) {
        error.textContent = "Tanggal rilis wajib diisi.";
        error.classList.add("is-visible");
        $("#chapter-editor-date").focus();
        return;
      }

      var previous = {
        title: chapter.title,
        date: chapter.date,
        content: chapter.content,
        published: chapter.published
      };

      chapter.title = title;
      chapter.date = date;
      chapter.content = $("#chapter-editor-content").value.replace(/\r\n/g, "\n").trim();
      chapter.published = $("#chapter-editor-published").checked;

      if (!await commit("Naskah Bab " + chapter.number + " tersimpan.")) {
        Object.assign(chapter, previous);
        return;
      }

      closeDialog($("#chapter-editor-dialog"));
      renderChapterTable();
      renderReleasePreview();
      renderSummary();
    });

    $("#chapter-table-body").addEventListener("change", async function (event) {
      var input = event.target.closest("[data-chapter-toggle]");
      if (!input) {
        return;
      }

      var chapter = DATA.chapters.find(function (item) {
        return item.id === input.getAttribute("data-chapter-toggle");
      });
      if (!chapter) {
        return;
      }

      chapter.published = input.checked;
      if (!await commit("Bab " + chapter.number + (chapter.published ? " dirilis." : " dikembalikan ke draf."))) {
        chapter.published = !input.checked;
        input.checked = !input.checked;
        return;
      }

      renderChapterTable();
      renderReleasePreview();
      renderSummary();
    });

    $("#chapter-table-body").addEventListener("click", async function (event) {
      var editButton = event.target.closest("[data-edit-chapter]");
      if (editButton) {
        var editChapter = DATA.chapters.find(function (item) {
          return item.id === editButton.getAttribute("data-edit-chapter");
        });
        if (editChapter) {
          openChapterEditor(editChapter);
        }
        return;
      }

      var button = event.target.closest("[data-delete-chapter]");
      if (!button) {
        return;
      }

      var chapter = DATA.chapters.find(function (item) {
        return item.id === button.getAttribute("data-delete-chapter");
      });
      if (!chapter) {
        return;
      }

      if (!window.confirm('Hapus Bab ' + chapter.number + ' "' + chapter.title + '"?')) {
        return;
      }

      var previousChapters = DATA.chapters.slice();
      DATA.chapters = DATA.chapters.filter(function (item) {
        return item.id !== chapter.id;
      });
      if (await commit("Bab dihapus.")) {
        renderChapterTable();
        renderReleasePreview();
        renderSummary();
      } else {
        DATA.chapters = previousChapters;
      }
    });

    $("#novel-table-body").addEventListener("click", async function (event) {
      var toggle = event.target.closest("[data-toggle-novel]");
      if (toggle) {
        var novel = novelById(toggle.getAttribute("data-toggle-novel"));
        if (!novel) {
          return;
        }
        novel.visible = !novel.visible;
        if (await commit('"' + novel.title + '" ' + (novel.visible ? "ditampilkan." : "disembunyikan."))) {
          renderCatalog();
          renderHome();
          renderNovelSelect();
          renderSummary();
        } else {
          novel.visible = !novel.visible;
        }
        return;
      }

      var remove = event.target.closest("[data-delete-novel]");
      if (remove) {
        var targetNovel = novelById(remove.getAttribute("data-delete-novel"));
        if (!targetNovel) {
          return;
        }
        if (!window.confirm('Hapus "' + targetNovel.title + '" dari katalog? Semua bab novel ini juga akan dihapus.')) {
          return;
        }

        var previousData = {
          novels: DATA.novels.slice(),
          chapters: DATA.chapters.slice(),
          comments: DATA.comments.slice(),
          home: {
            latest: DATA.home.latest.slice(),
            trending: DATA.home.trending.slice(),
            spotlight: DATA.home.spotlight
          },
          selectedNovelId: selectedNovelId
        };

        DATA.novels = DATA.novels.filter(function (item) { return item.id !== targetNovel.id; });
        DATA.chapters = DATA.chapters.filter(function (chapter) { return chapter.novelId !== targetNovel.id; });
        DATA.comments = DATA.comments.filter(function (comment) { return comment.novelId !== targetNovel.id; });
        DATA.home.latest = DATA.home.latest.filter(function (id) { return id !== targetNovel.id; });
        DATA.home.trending = DATA.home.trending.filter(function (id) { return id !== targetNovel.id; });
        if (DATA.home.spotlight === targetNovel.id) {
          DATA.home.spotlight = DATA.novels.length ? DATA.novels[0].id : "";
        }
        if (selectedNovelId === targetNovel.id) {
          selectedNovelId = DATA.novels.length ? DATA.novels[0].id : "";
        }

        if (await commit("Novel dihapus dari katalog.")) {
          renderAll();
        } else {
          DATA.novels = previousData.novels;
          DATA.chapters = previousData.chapters;
          DATA.comments = previousData.comments;
          DATA.home = previousData.home;
          selectedNovelId = previousData.selectedNovelId;
        }
      }
    });

    $("#submission-filter").addEventListener("change", renderInbox);

    $("#submission-list").addEventListener("click", async function (event) {
      var markButton = event.target.closest("[data-mark-submission]");
      if (markButton) {
        var submission = DATA.submissions.find(function (item) {
          return item.id === markButton.getAttribute("data-mark-submission");
        });
        if (!submission) {
          return;
        }
        var previousStatus = submission.status;
        submission.status = "dibaca";
        if (await commit("Kiriman ditandai sudah dibaca.")) {
          renderInbox();
          renderSummary();
        } else {
          submission.status = previousStatus;
        }
        return;
      }

      var remove = event.target.closest("[data-delete-submission]");
      if (remove) {
        var target = DATA.submissions.find(function (item) {
          return item.id === remove.getAttribute("data-delete-submission");
        });
        if (!target) {
          return;
        }
        if (!window.confirm('Hapus kiriman "' + target.novelTitle + '" dari ' + target.name + "?")) {
          return;
        }
        var previousSubmissions = DATA.submissions.slice();
        DATA.submissions = DATA.submissions.filter(function (item) {
          return item.id !== target.id;
        });
        if (await commit("Kiriman dihapus.")) {
          renderInbox();
          renderSummary();
        } else {
          DATA.submissions = previousSubmissions;
        }
      }
    });

    $("#comment-filter").addEventListener("change", renderComments);

    $("#dash-comment-list").addEventListener("click", async function (event) {
      var editButton = event.target.closest("[data-edit-comment]");
      if (editButton) {
        var comment = DATA.comments.find(function (item) {
          return item.id === editButton.getAttribute("data-edit-comment");
        });
        if (comment) {
          openCommentEditor(comment);
        }
        return;
      }

      var remove = event.target.closest("[data-delete-comment]");
      if (!remove) {
        return;
      }
      var targetComment = DATA.comments.find(function (item) {
        return item.id === remove.getAttribute("data-delete-comment");
      });
      if (!targetComment) {
        return;
      }
      if (!window.confirm('Hapus komentar dari ' + targetComment.name + "?")) {
        return;
      }
      var previousComments = DATA.comments.slice();
      DATA.comments = DATA.comments.filter(function (item) {
        return item.id !== targetComment.id;
      });
      if (await commit("Komentar dihapus.")) {
        renderComments();
      } else {
        DATA.comments = previousComments;
      }
    });

    $("#comment-dialog").addEventListener("close", resetCommentEditor);

    $("#comment-editor-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      var comment = DATA.comments.find(function (item) {
        return item.id === editingCommentId;
      });
      var error = $("#comment-form-error");
      if (!comment) {
        error.textContent = "Komentar tidak ditemukan. Muat ulang dashboard.";
        error.classList.add("is-visible");
        return;
      }

      var name = $("#comment-editor-name").value.trim();
      var message = $("#comment-editor-message").value.trim();
      if (!name) {
        error.textContent = "Nama wajib diisi.";
        error.classList.add("is-visible");
        $("#comment-editor-name").focus();
        return;
      }
      if (!message) {
        error.textContent = "Isi komentar wajib diisi.";
        error.classList.add("is-visible");
        $("#comment-editor-message").focus();
        return;
      }

      var previous = { name: comment.name, message: comment.message };
      comment.name = name;
      comment.message = message;

      if (await commit("Komentar tersimpan.")) {
        closeDialog($("#comment-dialog"));
        renderComments();
      } else {
        Object.assign(comment, previous);
      }
    });

    window.setInterval(function () {
      var session = getSession();
      if (!session || !session.expiresAt || Date.now() >= session.expiresAt) {
        logout();
      }
    }, 60000);
  }

  async function init() {
    var session = getSession();
    if (!session || !session.expiresAt || Date.now() >= session.expiresAt) {
      logout();
      return;
    }

    initEvents();
    await loadState();
    selectedNovelId = DATA.novels.length ? DATA.novels[0].id : "";
    renderAll();

    var initialView = window.location.hash.replace("#", "");
    setView(VIEWS[initialView] ? initialView : "ringkasan", false);
  }

  init();
})();
