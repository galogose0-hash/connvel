(function () {
  "use strict";

  var controls = document.querySelectorAll("[data-reader-next]");
  if (!controls.length || !window.ConnvelStore) {
    return;
  }

  var store = window.ConnvelStore.load();

  Array.prototype.forEach.call(controls, function (control) {
    var novelId = control.getAttribute("data-novel-id");
    var nextNumber = parseInt(control.getAttribute("data-next-number"), 10);
    var href = control.getAttribute("data-next-href");
    var chapter = store.chapters.find(function (item) {
      return item.novelId === novelId && Number(item.number) === nextNumber;
    });

    if (!chapter || !chapter.published || !href) {
      return;
    }

    var link = document.createElement("a");
    link.className = "chapter-btn chapter-btn--next";
    link.href = href;
    link.innerHTML = control.innerHTML;
    link.setAttribute("title", "Lanjut ke Bab " + nextNumber + " - " + chapter.title);
    control.parentNode.replaceChild(link, control);
  });
})();
