(function () {
  "use strict";

  var list = document.getElementById("author-list");
  if (!list) return;

  var searchInput = document.getElementById("author-search");
  var genreSelect = document.getElementById("author-genre");
  var sortSelect = document.getElementById("author-sort");
  var countLabel = document.getElementById("author-count");
  var emptyState = document.getElementById("author-empty");

  function readText(item, name) {
    return (item.getAttribute(name) || "").toLowerCase();
  }

  function readNumber(item, name) {
    return parseFloat(item.getAttribute(name)) || 0;
  }

  function getItems() {
    return Array.prototype.slice.call(list.querySelectorAll(".author-row-item"));
  }

  function sortItems() {
    var mode = sortSelect ? sortSelect.value : "nama";
    var items = getItems();

    items.sort(function (a, b) {
      if (mode === "pena") return readText(a, "data-pen-name").localeCompare(readText(b, "data-pen-name"), "id");
      if (mode === "karya") return readNumber(b, "data-works") - readNumber(a, "data-works");
      return readText(a, "data-name").localeCompare(readText(b, "data-name"), "id");
    });

    items.forEach(function (item) {
      list.appendChild(item);
    });
  }

  function applyFilters() {
    var term = searchInput ? searchInput.value.trim().toLowerCase() : "";
    var genre = genreSelect ? genreSelect.value : "all";
    var visible = 0;

    getItems().forEach(function (item) {
      var haystack = [readText(item, "data-name"), readText(item, "data-pen-name"), readText(item, "data-background")].join(" ");
      var matchesTerm = !term || haystack.indexOf(term) !== -1;
      var itemGenres = (item.getAttribute("data-genre") || "").split(/\s+/);
      var matchesGenre = genre === "all" || itemGenres.indexOf(genre) !== -1;
      var show = matchesTerm && matchesGenre;

      item.hidden = !show;
      if (show) visible += 1;
    });

    if (countLabel) {
      countLabel.textContent = visible + " penulis";
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

  document.addEventListener("connvel:authors-updated", update);

  update();
})();
