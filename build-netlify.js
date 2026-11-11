"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = __dirname;
var DATA_FILE = path.join(ROOT, "data", "connvel.json");
var OUT_DIR = path.join(ROOT, "netlify-site");

var ROOT_FILES = ["index.html", "browse.html", "donate.html"];
var COPY_DIRS = ["novelis", "tentang", "novel", "ceritanovel"];
var ASSETS_SKIP = [
  "js/dashboard.js",
  "js/dashboard-login.js",
  "css/dashboard.css"
];

function readState() {
  var raw;
  try {
    raw = fs.readFileSync(DATA_FILE, "utf8");
  } catch (error) {
    console.error("Berkas data/connvel.json tidak ditemukan. Jalankan `npm run seed` terlebih dahulu.");
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Berkas data/connvel.json tidak valid: " + error.message);
    process.exit(1);
  }
}

function publicNovel(novel) {
  return {
    id: novel.id,
    title: novel.title,
    author: novel.author,
    genre: novel.genre,
    status: novel.status,
    chapters: novel.chapters,
    visible: novel.visible !== false,
    poster: novel.poster,
    synopsis: novel.synopsis
  };
}

function buildPublicState(state) {
  var novels = (Array.isArray(state.novels) ? state.novels : [])
    .filter(function (novel) {
      return novel && novel.visible !== false;
    })
    .map(publicNovel);

  return {
    novels: novels,
    home: state.home && typeof state.home === "object" ? state.home : {},
    comments: Array.isArray(state.comments) ? state.comments : [],
    submissions: []
  };
}

function relativePath(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function copyDirectory(source, target, skipList, baseDir) {
  fs.mkdirSync(target, { recursive: true });
  fs.readdirSync(source, { withFileTypes: true }).forEach(function (entry) {
    var fromPath = path.join(source, entry.name);
    var toPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(fromPath, toPath, skipList, baseDir);
      return;
    }
    if (!entry.isFile()) {
      return;
    }
    if (skipList.indexOf(relativePath(baseDir, fromPath)) !== -1) {
      return;
    }
    fs.copyFileSync(fromPath, toPath);
  });
}

function countFiles(dir) {
  var total = 0;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.isDirectory()) {
      total += countFiles(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      total += 1;
    }
  });
  return total;
}

function main() {
  var state = readState();
  var publicState = buildPublicState(state);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  ROOT_FILES.forEach(function (name) {
    var fromPath = path.join(ROOT, name);
    if (fs.existsSync(fromPath)) {
      fs.copyFileSync(fromPath, path.join(OUT_DIR, name));
    }
  });

  COPY_DIRS.forEach(function (dir) {
    var fromPath = path.join(ROOT, dir);
    if (fs.existsSync(fromPath)) {
      copyDirectory(fromPath, path.join(OUT_DIR, dir), [], fromPath);
    }
  });

  copyDirectory(
    path.join(ROOT, "assets"),
    path.join(OUT_DIR, "assets"),
    ASSETS_SKIP,
    path.join(ROOT, "assets")
  );

  fs.mkdirSync(path.join(OUT_DIR, "api"), { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "api", "state.json"),
    JSON.stringify(publicState, null, 2) + "\n",
    "utf8"
  );

  console.log("Situs publik Connvel berhasil dibangun di netlify-site/.");
  console.log("- Novel tampil: " + publicState.novels.length);
  console.log("- Komentar tampil: " + publicState.comments.length);
  console.log("- Kiriman penulis tidak disertakan (hanya untuk dashboard lokal).");
  console.log("- Total berkas: " + countFiles(OUT_DIR));
}

main();
