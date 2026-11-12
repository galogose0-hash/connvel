(function () {
  "use strict";

  var list = document.getElementById("novel-list");
  if (!list) return;

  var searchInput = document.getElementById("browse-search");
  var genreSelect = document.getElementById("browse-genre");
  var sortSelect = document.getElementById("browse-sort");
  var countLabel = document.getElementById("browse-count");
  var emptyState = document.getElementById("browse-empty");

  function readNumber(item, name) {
    return parseFloat(item.getAttribute(name)) || 0;
  }

  function readText(item, name) {
    return (item.getAttribute(name) || "").toLowerCase();
  }

  function getItems() {
    return Array.prototype.slice.call(list.querySelectorAll(".novel-row-item"));
  }

  function sortItems() {
    var mode = sortSelect ? sortSelect.value : "populer";
    var items = getItems();

    items.sort(function (a, b) {
      if (mode === "terbaru") return readText(b, "data-date").localeCompare(readText(a, "data-date"));
      if (mode === "judul") return readText(a, "data-title").localeCompare(readText(b, "data-title"), "id");
      return readNumber(b, "data-popularity") - readNumber(a, "data-popularity");
    });

    items.forEach(function (item) {
      list.appendChild(item);
    });
  }

  function applyFilters() {
    var term = searchInput ? searchInput.value.trim().toLowerCase() : "";
    var genre = genreSelect ? genreSelect.value : "all";
    var visible = 0;
    var items = getItems();

    items.forEach(function (item) {
      var haystack = readText(item, "data-title") + " " + readText(item, "data-author");
      var matchesTerm = !term || haystack.indexOf(term) !== -1;
      var itemGenres = (item.getAttribute("data-genre") || "").split(/\s+/);
      var matchesGenre = genre === "all" || itemGenres.indexOf(genre) !== -1;
      var show = matchesTerm && matchesGenre;

      item.hidden = !show;
      if (show) visible += 1;
    });

    if (countLabel) {
      countLabel.textContent = visible + " cerita";
    }

    if (emptyState) {
      emptyState.hidden = visible !== 0;
    }
  }

  function update() {
    sortItems();
    applyFilters();
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (genreSelect) genreSelect.addEventListener("change", applyFilters);
  if (sortSelect) sortSelect.addEventListener("change", update);

  document.addEventListener("connvel:catalog-updated", function () {
    update();
  });

  update();
})();
