(function () {
  "use strict";

  var timeElement = document.getElementById("clock-time");
  var dateElement = document.getElementById("clock-date");
  var card = document.getElementById("announcement-card");
  var titleElement = document.getElementById("announcement-title");
  var dateLabel = document.getElementById("announcement-date");
  var bodyElement = document.getElementById("announcement-body");
  var emptyElement = document.getElementById("announcement-empty");

  function setClock() {
    var now = new Date();
    var timeParts = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    var values = {};

    timeParts.forEach(function (part) {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }
    });

    timeElement.textContent = values.hour + ":" + values.minute + ":" + values.second;
    dateElement.textContent = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(now);
  }

  function parseDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) {
      return null;
    }
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function formatDate(value) {
    var date = parseDate(value);
    if (!date) {
      return "";
    }
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function showEmpty() {
    card.classList.add("is-empty");
    titleElement.hidden = true;
    dateLabel.hidden = true;
    bodyElement.hidden = true;
    emptyElement.hidden = false;
  }

  function showAnnouncement(announcement) {
    card.classList.remove("is-empty");
    titleElement.hidden = false;
    dateLabel.hidden = false;
    bodyElement.hidden = false;
    emptyElement.hidden = true;

    titleElement.textContent = announcement.title;
    bodyElement.textContent = announcement.body || "";
    dateLabel.textContent = formatDate(announcement.date);
    dateLabel.setAttribute("datetime", announcement.date || "");
  }

  function applyState(data) {
    var announcement = data && data.announcement;
    if (!announcement || announcement.visible === false || !announcement.title) {
      showEmpty();
      return;
    }
    showAnnouncement(announcement);
  }

  function loadLocalState() {
    try {
      if (!window.ConnvelStore) {
        applyState(null);
        return;
      }
      if (!window.localStorage.getItem(window.ConnvelStore.STORAGE_KEY)) {
        applyState(window.ConnvelStore.load());
        return;
      }
      applyState(window.ConnvelStore.load());
    } catch (error) {
      applyState(null);
    }
  }

  function loadAnnouncement() {
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
    }).catch(loadLocalState);
  }

  setClock();
  window.setInterval(setClock, 1000);
  loadAnnouncement();
  window.setInterval(loadAnnouncement, 60000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      setClock();
      loadAnnouncement();
    }
  });

  window.addEventListener("storage", function (event) {
    if (window.ConnvelStore && event.key === window.ConnvelStore.STORAGE_KEY) {
      loadLocalState();
    }
  });
})();
