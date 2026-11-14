(function () {
  "use strict";

  var listElement = document.getElementById("announcement-list");
  var countElement = document.getElementById("announcement-count");
  var emptyElement = document.getElementById("announcement-empty");

  function sortNewestFirst(list) {
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

  function announcementsFrom(data) {
    var source = data && typeof data === "object" ? data : {};
    var list = Array.isArray(source.announcements) ? source.announcements : [];

    if (!list.length && source.announcement && typeof source.announcement === "object" && source.announcement.title) {
      list = [source.announcement];
    }

    return sortNewestFirst(list.filter(function (item) {
      return item && typeof item === "object" && item.visible !== false && String(item.title || "").trim();
    }).map(function (item, index) {
      return {
        id: String(item.id || "").trim() || "ann-" + (index + 1),
        title: String(item.title || "").trim(),
        body: String(item.body || "").trim(),
        date: String(item.date || "").slice(0, 10)
      };
    }));
  }

  function buildEntry(item, index, openIds) {
    var details = document.createElement("details");
    details.className = "info-entry" + (index === 0 ? " is-latest" : "");
    details.setAttribute("data-announcement", item.id);
    if (index === 0 || openIds[item.id]) {
      details.open = true;
    }

    var summary = document.createElement("summary");
    summary.className = "info-entry-summary";

    var counter = document.createElement("span");
    counter.className = "info-entry-index";
    counter.textContent = (index + 1 < 10 ? "0" : "") + (index + 1);

    var main = document.createElement("span");
    main.className = "info-entry-main";

    var title = document.createElement("span");
    title.className = "info-entry-title";
    title.textContent = item.title;
    main.appendChild(title);

    if (index === 0) {
      var tag = document.createElement("span");
      tag.className = "info-entry-tag";
      tag.textContent = "Terbaru";
      main.appendChild(tag);
    }

    var icon = document.createElement("span");
    icon.className = "info-entry-icon";
    icon.setAttribute("aria-hidden", "true");

    summary.appendChild(counter);
    summary.appendChild(main);
    summary.appendChild(icon);

    var body = document.createElement("div");
    body.className = "info-entry-body";
    body.textContent = item.body || "Belum ada isi pengumuman.";

    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  function render(data) {
    var announcements = announcementsFrom(data);
    var openIds = {};

    Array.prototype.forEach.call(listElement.querySelectorAll("details[open]"), function (entry) {
      openIds[entry.getAttribute("data-announcement")] = true;
    });

    listElement.innerHTML = "";

    if (!announcements.length) {
      listElement.hidden = true;
      countElement.textContent = "";
      emptyElement.hidden = false;
      return;
    }

    emptyElement.hidden = true;
    listElement.hidden = false;
    countElement.textContent = announcements.length + " kabar";

    announcements.forEach(function (item, index) {
      listElement.appendChild(buildEntry(item, index, openIds));
    });
  }

  function loadLocalState() {
    try {
      render(window.ConnvelStore ? window.ConnvelStore.load() : null);
    } catch (error) {
      render(null);
    }
  }

  function loadAnnouncements() {
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
      render(payload && payload.state ? payload.state : payload);
    }).catch(loadLocalState);
  }

  loadAnnouncements();
  window.setInterval(loadAnnouncements, 60000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      loadAnnouncements();
    }
  });

  window.addEventListener("storage", function (event) {
    if (window.ConnvelStore && event.key === window.ConnvelStore.STORAGE_KEY) {
      loadLocalState();
    }
  });
})();
