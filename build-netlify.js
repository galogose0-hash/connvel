"use strict";

var fs = require("fs");
var path = require("path");
var normalizeState = require("./server/normalize").normalizeState;

var ROOT = __dirname;
var DATA_FILE = path.join(ROOT, "data", "connvel.json");
var OUT_DIR = path.join(ROOT, "netlify-site");
var FUNCTIONS_SHARED_DIR = path.join(ROOT, "netlify", "functions", "shared");
var SEED_FILE = path.join(FUNCTIONS_SHARED_DIR, "seed-state.mjs");

var ROOT_FILES = ["index.html", "browse.html", "donate.html"];
var COPY_DIRS = ["novelis", "tentang", "dashboard", "info"];
var ASSETS_SKIP = [];

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

function writeSeedState(state) {
  fs.mkdirSync(FUNCTIONS_SHARED_DIR, { recursive: true });
  var seed = normalizeState(state);
  fs.writeFileSync(
    SEED_FILE,
    "export default " + JSON.stringify(seed, null, 2) + ";\n",
    "utf8"
  );
  return seed;
}

function main() {
  var state = readState();
  var seed = writeSeedState(state);

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

  console.log("Situs Connvel berhasil dibangun di netlify-site/.");
  console.log("- Novel: " + seed.novels.length + " (halaman novel dan bab dilayani oleh Netlify Functions)");
  console.log("- Bab: " + seed.chapters.length);
  console.log("- Komentar: " + seed.comments.length);
  console.log("- Kiriman penulis: " + seed.submissions.length + " (ikut seed awal Blobs)");
  console.log("- Seed Functions: " + path.relative(ROOT, SEED_FILE));
  console.log("- Total berkas statis: " + countFiles(OUT_DIR));
}

main();
