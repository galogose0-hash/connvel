"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");
var url = require("url");
var crypto = require("crypto");
var render = require("./server/render");

var ROOT = __dirname;
var DATA_DIR = path.join(ROOT, "data");
var DATA_FILE = path.join(DATA_DIR, "connvel.json");
var UPLOAD_DIR = path.join(ROOT, "assets", "images", "uploads");
var NOVEL_DIR = path.join(ROOT, "novel");
var CHAPTER_ROOT = path.join(ROOT, "ceritanovel");
var MAX_BODY = 16 * 1024 * 1024;
var PORT = Number(process.env.PORT) || 3000;

var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function ensureDirs() {
  [DATA_DIR, UPLOAD_DIR, NOVEL_DIR, CHAPTER_ROOT].forEach(function (dir) {
    fs.mkdirSync(dir, { recursive: true });
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readStateOrNull() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    return null;
  }
}

function readState() {
  var state = readStateOrNull();
  if (!state) {
    var error = new Error("Berkas data/connvel.json belum tersedia. Jalankan node server/seed.js terlebih dahulu.");
    error.statusCode = 503;
    throw error;
  }
  return state;
}

function writeState(state) {
  ensureDirs();
  var temporary = DATA_FILE + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + "\n", "utf8");
  fs.renameSync(temporary, DATA_FILE);
}

function toInteger(value, fallback) {
  var number = parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueId(base, used) {
  var id = base || "novel";
  var index = 2;
  while (used[id]) {
    id = base + "-" + index;
    index += 1;
  }
  used[id] = true;
  return id;
}

function normalizeState(raw) {
  var source = raw && typeof raw === "object" ? raw : {};
  var usedNovelIds = {};
  var novels = [];
  var novelIdMap = {};

  (Array.isArray(source.novels) ? source.novels : []).forEach(function (candidate) {
    if (!candidate || typeof candidate !== "object") {
      return;
    }
    var title = String(candidate.title || "").trim();
    if (!title) {
      return;
    }
    var baseId = render.slugify(candidate.id) || render.slugify(title) || "novel";
    var id = uniqueId(baseId, usedNovelIds);
    if (candidate.id && candidate.id !== id) {
      novelIdMap[candidate.id] = id;
    }
    novels.push({
      id: id,
      title: title,
      author: String(candidate.author || "").trim(),
      genre: String(candidate.genre || "Fantasi").trim(),
      status: candidate.status === "Completed" ? "Completed" : "Ongoing",
      chapters: Math.max(0, toInteger(candidate.chapters, 0)),
      visible: candidate.visible !== false,
      poster: String(candidate.poster || "").trim(),
      synopsis: String(candidate.synopsis || "").trim()
    });
  });

  var knownNovelIds = {};
  novels.forEach(function (novel) {
    knownNovelIds[novel.id] = true;
  });

  var usedChapterIds = {};
  var chapterKeys = {};
  var chapters = [];

  (Array.isArray(source.chapters) ? source.chapters : []).forEach(function (candidate) {
    if (!candidate || typeof candidate !== "object") {
      return;
    }
    var novelId = novelIdMap[candidate.novelId] || candidate.novelId;
    if (!knownNovelIds[novelId]) {
      return;
    }
    var number = toInteger(candidate.number, 0);
    if (number < 1) {
      return;
    }
    var key = novelId + ":" + number;
    if (chapterKeys[key]) {
      return;
    }
    chapterKeys[key] = true;

    var desiredId = String(candidate.id || "").trim() || novelId + "-bab-" + number;
    var id = desiredId;
    var suffix = 2;
    while (usedChapterIds[id]) {
      id = desiredId + "-" + suffix;
      suffix += 1;
    }
    usedChapterIds[id] = true;

    chapters.push({
      id: id,
      novelId: novelId,
      number: number,
      title: String(candidate.title || "Bab " + number).trim(),
      date: String(candidate.date || "").slice(0, 10),
      published: Boolean(candidate.published),
      content: String(candidate.content || "")
    });
  });

  chapters.sort(function (a, b) {
    if (a.novelId !== b.novelId) {
      return a.novelId.localeCompare(b.novelId);
    }
    return a.number - b.number;
  });

  novels.forEach(function (novel) {
    var own = chapters.filter(function (chapter) { return chapter.novelId === novel.id; });
    var highest = own.reduce(function (max, chapter) {
      return Math.max(max, chapter.number);
    }, 0);
    if (!novel.chapters) {
      novel.chapters = highest;
    }
  });

  var visibleIds = novels.filter(function (novel) { return novel.visible; }).map(function (novel) {
    return novel.id;
  });

  function uniqueKnownIds(values, limit) {
    var seen = {};
    var result = [];
    (Array.isArray(values) ? values : []).forEach(function (value) {
      var id = novelIdMap[value] || value;
      if (knownNovelIds[id] && !seen[id] && result.length < limit) {
        seen[id] = true;
        result.push(id);
      }
    });
    return result;
  }

  var homeSource = source.home && typeof source.home === "object" ? source.home : {};
  var latest = uniqueKnownIds(homeSource.latest, 6);
  var trending = uniqueKnownIds(homeSource.trending, 3);
  var spotlight = novelIdMap[homeSource.spotlight] || homeSource.spotlight;
  if (!knownNovelIds[spotlight] || visibleIds.indexOf(spotlight) === -1) {
    spotlight = visibleIds[0] || novels[0] && novels[0].id || "";
  }

  var submissions = (Array.isArray(source.submissions) ? source.submissions : [])
    .filter(function (submission) {
      return submission && typeof submission === "object" && submission.id;
    })
    .map(function (submission) {
      return {
        id: String(submission.id),
        name: String(submission.name || ""),
        email: String(submission.email || ""),
        phone: String(submission.phone || ""),
        novelTitle: String(submission.novelTitle || ""),
        chapter: String(submission.chapter || ""),
        message: String(submission.message || ""),
        date: String(submission.date || ""),
        status: submission.status === "dibaca" ? "dibaca" : "baru"
      };
    });

  var usedCommentIds = {};
  var comments = [];

  (Array.isArray(source.comments) ? source.comments : []).forEach(function (candidate) {
    if (!candidate || typeof candidate !== "object") {
      return;
    }
    var novelId = novelIdMap[candidate.novelId] || String(candidate.novelId || "");
    var message = String(candidate.message || "").trim();
    if (!message || !knownNovelIds[novelId]) {
      return;
    }
    var desiredId = String(candidate.id || "").trim() || "com-" + (comments.length + 1);
    var id = desiredId;
    var suffix = 2;
    while (usedCommentIds[id]) {
      id = desiredId + "-" + suffix;
      suffix += 1;
    }
    usedCommentIds[id] = true;

    comments.push({
      id: id,
      novelId: novelId,
      name: String(candidate.name || "").trim() || "Pembaca Connvel",
      message: message,
      date: String(candidate.date || "")
    });
  });

  return {
    novels: novels,
    chapters: chapters,
    home: {
      spotlight: spotlight,
      latest: latest,
      trending: trending
    },
    submissions: submissions,
    comments: comments
  };
}

function extensionForMime(mime) {
  var subtype = String(mime || "image/png").split("/")[1] || "png";
  subtype = subtype.split("+")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (subtype === "jpeg") {
    return "jpg";
  }
  return subtype || "png";
}

function persistPoster(novel) {
  var match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(novel.poster);
  if (!match) {
    return;
  }

  var mime = match[1].toLowerCase();
  var buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
    throw new Error("Poster " + novel.title + " tidak valid atau terlalu besar.");
  }

  ensureDirs();
  var filename = novel.id + "-poster." + extensionForMime(mime);
  var absolute = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(absolute, buffer);

  var previous = String(novel.poster || "");
  var nextPath = "assets/images/uploads/" + filename;
  if (previous.indexOf("assets/images/uploads/") === 0 && previous !== nextPath) {
    var oldAbsolute = path.join(ROOT, previous);
    try {
      if (fs.existsSync(oldAbsolute)) {
        fs.unlinkSync(oldAbsolute);
      }
    } catch (error) {
      /* Poster lama boleh tetap ada jika gagal dihapus. */
    }
  }

  novel.poster = nextPath;
}

function processPosters(state) {
  state.novels.forEach(persistPoster);
}

function absolutePoster(novel) {
  if (!novel.poster || novel.poster.indexOf("data:") === 0) {
    return null;
  }
  return path.join(ROOT, novel.poster.replace(/^(\.\.\/)+/, ""));
}

function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    /* File yang sudah tidak ada bukan alasan untuk menggagalkan sinkronisasi. */
  }
}

function removeDirectory(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (error) {
    /* Direktori yang sudah hilang aman diabaikan. */
  }
}

function chaptersFor(state, novelId) {
  return state.chapters
    .filter(function (chapter) { return chapter.novelId === novelId; })
    .slice()
    .sort(function (a, b) { return a.number - b.number; });
}

function syncGeneratedFiles(state, previousState) {
  ensureDirs();

  if (previousState && Array.isArray(previousState.novels)) {
    var currentIds = {};
    state.novels.forEach(function (novel) {
      currentIds[novel.id] = true;
    });
    previousState.novels.forEach(function (oldNovel) {
      if (!oldNovel || !oldNovel.id || currentIds[oldNovel.id]) {
        return;
      }
      removeFile(path.join(NOVEL_DIR, oldNovel.id + ".html"));
      removeDirectory(path.join(CHAPTER_ROOT, oldNovel.id));
      var poster = absolutePoster(oldNovel);
      if (poster && poster.indexOf(UPLOAD_DIR) === 0) {
        removeFile(poster);
      }
    });
  }

  state.novels.forEach(function (novel) {
    var chapters = chaptersFor(state, novel.id);
    var chapterDir = path.join(CHAPTER_ROOT, novel.id);
    fs.mkdirSync(chapterDir, { recursive: true });

    fs.writeFileSync(
      path.join(NOVEL_DIR, novel.id + ".html"),
      render.renderNovelPage(novel, chapters),
      "utf8"
    );

    var expected = {};
    chapters.forEach(function (chapter) {
      var filename = "bab-" + chapter.number + ".html";
      expected[filename] = true;
      fs.writeFileSync(
        path.join(chapterDir, filename),
        render.renderChapterPage(novel, chapter, chapters),
        "utf8"
      );
    });

    fs.readdirSync(chapterDir).forEach(function (filename) {
      if (/^bab-\d+\.html$/i.test(filename) && !expected[filename]) {
        removeFile(path.join(chapterDir, filename));
      }
    });
  });
}

function sendJson(response, statusCode, payload) {
  var body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function readBody(request) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    var finished = false;

    request.on("data", function (chunk) {
      if (finished) {
        return;
      }
      size += chunk.length;
      if (size > MAX_BODY) {
        finished = true;
        reject(Object.assign(new Error("Data terlalu besar. Maksimal 16 MB."), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", function () {
      if (!finished) {
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });

    request.on("error", function (error) {
      if (!finished) {
        finished = true;
        reject(error);
      }
    });
  });
}

function parseJsonBody(raw) {
  if (!raw || !raw.trim()) {
    throw Object.assign(new Error("Body JSON kosong."), { statusCode: 400 });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw Object.assign(new Error("Body JSON tidak valid."), { statusCode: 400 });
  }
}

function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { ok: true, data: fs.existsSync(DATA_FILE) });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/state") {
    try {
      sendJson(response, 200, { state: readState() });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    }
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/state") {
    readBody(request).then(function (raw) {
      var payload = parseJsonBody(raw);
      var candidate = payload && payload.state ? payload.state : payload;
      var previous = readStateOrNull();
      var state = normalizeState(candidate);
      processPosters(state);
      writeState(state);
      syncGeneratedFiles(state, previous);
      sendJson(response, 200, { state: state });
    }).catch(function (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/comments") {
    readBody(request).then(function (raw) {
      var payload = parseJsonBody(raw);
      var state = readState();
      var novelId = String((payload && payload.novelId) || "");
      var novel = state.novels.find(function (item) { return item.id === novelId; });
      if (!novel) {
        throw Object.assign(new Error("Novel tidak ditemukan."), { statusCode: 404 });
      }

      var name = String((payload && payload.name) || "").trim().slice(0, 40);
      var message = String((payload && payload.message) || "").trim().slice(0, 1000);
      if (!name) {
        throw Object.assign(new Error("Nama wajib diisi."), { statusCode: 400 });
      }
      if (!message) {
        throw Object.assign(new Error("Komentar wajib diisi."), { statusCode: 400 });
      }

      var comment = {
        id: "com-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex"),
        novelId: novelId,
        name: name,
        message: message,
        date: new Date().toISOString()
      };
      state.comments = Array.isArray(state.comments) ? state.comments : [];
      state.comments.push(comment);
      writeState(state);
      sendJson(response, 201, { comment: comment });
    }).catch(function (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/submissions") {
    readBody(request).then(function (raw) {
      var payload = parseJsonBody(raw) || {};
      var state = readState();

      var name = String(payload.name || payload.author_name || "").trim().slice(0, 80);
      var email = String(payload.email || "").trim().slice(0, 160);
      var phone = String(payload.phone || payload.whatsapp || "").trim().slice(0, 30);
      var novelTitle = String(payload.novelTitle || payload.novel_title || "").trim().slice(0, 140);
      var chapter = String(payload.chapter || payload.chapter_info || "").trim().slice(0, 100);
      var message = String(payload.message || payload.content || "").trim().slice(0, 20000);

      if (!name) {
        throw Object.assign(new Error("Nama penulis wajib diisi."), { statusCode: 400 });
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw Object.assign(new Error("Alamat email tidak valid."), { statusCode: 400 });
      }
      if (phone.replace(/\D/g, "").length < 8) {
        throw Object.assign(new Error("Nomor WhatsApp tidak valid."), { statusCode: 400 });
      }
      if (!novelTitle) {
        throw Object.assign(new Error("Judul novel wajib diisi."), { statusCode: 400 });
      }
      if (!chapter) {
        throw Object.assign(new Error("Bab / episode wajib diisi."), { statusCode: 400 });
      }
      if (!message) {
        throw Object.assign(new Error("Isi cerita wajib diisi."), { statusCode: 400 });
      }

      var submission = {
        id: "sub-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex"),
        name: name,
        email: email,
        phone: phone,
        novelTitle: novelTitle,
        chapter: chapter,
        message: message,
        date: new Date().toISOString(),
        status: "baru"
      };
      state.submissions = Array.isArray(state.submissions) ? state.submissions : [];
      state.submissions.push(submission);
      writeState(state);
      sendJson(response, 201, { submission: submission });
    }).catch(function (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    });
    return true;
  }

  return false;
}

function serveStatic(request, response, pathname) {
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    pathname = "/dashboard/panel.html";
  }

  var decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Alamat tidak valid.");
    return;
  }

  var target = path.resolve(ROOT, "." + decoded);
  if (target !== ROOT && target.indexOf(ROOT + path.sep) !== 0) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Akses ditolak.");
    return;
  }

  fs.stat(target, function (statError, stats) {
    if (statError) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Halaman tidak ditemukan.");
      return;
    }

    if (stats.isDirectory()) {
      target = path.join(target, "index.html");
    }

    fs.readFile(target, function (readError, content) {
      if (readError) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Halaman tidak ditemukan.");
        return;
      }

      var extension = path.extname(target).toLowerCase();
      var contentType = MIME_TYPES[extension] || "application/octet-stream";
      var etag = '"' + crypto.createHash("md5").update(content).digest("hex") + '"';

      if (request.headers["if-none-match"] === etag) {
        response.writeHead(304, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          ETag: etag
        });
        response.end();
        return;
      }

      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": content.length,
        "Cache-Control": "no-cache",
        ETag: etag
      });
      response.end(content);
    });
  });
}

function createServer() {
  return http.createServer(function (request, response) {
    var parsed = url.parse(request.url || "/");
    var pathname = parsed.pathname || "/";

    try {
      if (pathname.indexOf("/api/") === 0) {
        if (handleApi(request, response, pathname)) {
          return;
        }
        sendJson(response, 404, { error: "Endpoint API tidak ditemukan." });
        return;
      }

      serveStatic(request, response, pathname);
    } catch (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    }
  });
}

function start() {
  ensureDirs();
  var server = createServer();
  server.listen(PORT, function () {
    console.log("Connvel berjalan di http://localhost:" + PORT);
    console.log("Dashboard: http://localhost:" + PORT + "/dashboard/");
    try {
      var state = readState();
      syncGeneratedFiles(state, null);
      console.log("Halaman novel dan bab sudah disinkronkan.");
    } catch (error) {
      console.warn("Sinkronisasi awal dilewati: " + error.message);
    }
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = {
  normalizeState: normalizeState,
  syncGeneratedFiles: syncGeneratedFiles,
  processPosters: processPosters,
  writeState: writeState,
  readState: readState,
  createServer: createServer,
  start: start
};
