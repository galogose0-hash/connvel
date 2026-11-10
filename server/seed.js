"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");
var STORE_FILE = path.join(ROOT, "assets", "js", "connvel-store.js");
var DATA_DIR = path.join(ROOT, "data");
var DATA_FILE = path.join(DATA_DIR, "connvel.json");

function loadDefaults() {
  var code = fs.readFileSync(STORE_FILE, "utf8");
  var sandbox = {
    window: {
      localStorage: {
        getItem: function () { return null; },
        setItem: function () {},
        removeItem: function () {}
      }
    }
  };
  vm.runInNewContext(code, sandbox, { filename: STORE_FILE });
  return JSON.parse(JSON.stringify(sandbox.window.ConnvelStore.defaults));
}

function extractChapterBody(html) {
  var marker = '<div class="chapter-body">';
  var start = html.indexOf(marker);
  if (start === -1) {
    return "";
  }

  var contentStart = start + marker.length;
  var depth = 1;
  var cursor = contentStart;
  var openPattern = /<div\b[^>]*>/gi;
  var closePattern = /<\/div>/gi;

  while (depth > 0 && cursor < html.length) {
    openPattern.lastIndex = cursor;
    closePattern.lastIndex = cursor;
    var open = openPattern.exec(html);
    var close = closePattern.exec(html);

    if (!close) {
      break;
    }

    if (open && open.index < close.index) {
      depth += 1;
      cursor = open.index + open[0].length;
    } else {
      depth -= 1;
      if (depth === 0) {
        return html.slice(contentStart, close.index).trim();
      }
      cursor = close.index + close[0].length;
    }
  }

  return "";
}

function main() {
  var state = loadDefaults();

  state.chapters.forEach(function (chapter) {
    var chapterFile = path.join(
      ROOT,
      "ceritanovel",
      chapter.novelId,
      "bab-" + chapter.number + ".html"
    );

    if (fs.existsSync(chapterFile)) {
      chapter.content = extractChapterBody(fs.readFileSync(chapterFile, "utf8"));
      if (chapter.number <= 2) {
        chapter.published = true;
      }
    }
  });

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
  console.log("Seed data ditulis ke " + DATA_FILE);
}

main();
