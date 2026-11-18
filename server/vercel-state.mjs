import { get, put } from "@vercel/blob";
import seedState from "./seed-state.mjs";
import { normalizeState } from "./normalize.js";

const STATE_PATHNAME = "connvel/state.json";
const POSTER_PREFIX = "connvel/posters/";
const BLOB_ACCESS = "private";
const MAX_POSTER_BYTES = 4 * 1024 * 1024;

export async function openStore() {
  return { kind: "vercel-blob" };
}

async function readBlobText(pathname) {
  var result = await get(pathname, { access: BLOB_ACCESS, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  return await new Response(result.stream).text();
}

export async function readState(store) {
  var raw = await readBlobText(STATE_PATHNAME);
  if (raw) {
    try {
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      /* Data rusak ditimpa ulang dari seed di bawah. */
    }
  }
  var seeded = normalizeState(seedState);
  await writeState(store, seeded);
  return seeded;
}

export async function writeState(store, state) {
  await put(STATE_PATHNAME, JSON.stringify(state), {
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

export function adminToken() {
  return String(process.env.CONNVEL_ADMIN_TOKEN || "").trim();
}

export function hasAuthHeader(request) {
  return Boolean(String(request.headers.get("authorization") || "").trim());
}

export function isAuthorized(request) {
  var token = adminToken();
  if (!token) {
    return false;
  }
  var header = String(request.headers.get("authorization") || "");
  return header === "Bearer " + token;
}

function posterPublicPath(novel) {
  var poster = String(novel.poster || "");
  if (!poster) {
    return poster;
  }
  if (poster.indexOf("data:") === 0 || poster.indexOf("/") === 0) {
    return "/api/poster/" + novel.id;
  }
  return poster;
}

export function sanitizeState(state) {
  var source = state && typeof state === "object" ? state : {};
  var novels = (Array.isArray(source.novels) ? source.novels : [])
    .filter(function (novel) {
      return novel && novel.visible !== false;
    })
    .map(function (novel) {
      return {
        id: novel.id,
        title: novel.title,
        author: novel.author,
        genre: novel.genre,
        type: novel.type === "Cerpen" ? "Cerpen" : "Novel",
        status: novel.status,
        chapters: novel.chapters,
        visible: true,
        poster: posterPublicPath(novel),
        synopsis: novel.synopsis
      };
    });

  var announcementSource = Array.isArray(source.announcements)
    ? source.announcements
    : source.announcement && typeof source.announcement === "object"
      ? [source.announcement]
      : [];

  var announcements = announcementSource
    .filter(function (announcement) {
      return announcement &&
        typeof announcement === "object" &&
        announcement.visible !== false &&
        String(announcement.title || "").trim();
    })
    .map(function (announcement) {
      return {
        id: String(announcement.id || ""),
        title: String(announcement.title || "").trim(),
        body: String(announcement.body || "").trim(),
        date: String(announcement.date || "").slice(0, 10),
        updatedAt: String(announcement.updatedAt || "").trim()
      };
    });

  return {
    novels: novels,
    home: source.home && typeof source.home === "object" ? source.home : {},
    announcements: announcements,
    comments: Array.isArray(source.comments) ? source.comments : [],
    submissions: []
  };
}

export async function persistPosters(store, state) {
  for (const novel of state.novels) {
    var poster = String(novel.poster || "");
    var match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(poster);
    if (!match) {
      continue;
    }
    var mime = match[1].toLowerCase();
    var bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_POSTER_BYTES) {
      var error = new Error("Poster " + novel.title + " tidak valid atau terlalu besar (maksimal 4 MB).");
      error.status = 413;
      throw error;
    }
    await put(POSTER_PREFIX + novel.id, bytes, {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mime
    });
    novel.poster = "/api/poster/" + novel.id;
  }
}

export async function readPoster(store, novelId) {
  var state = await readState(store);
  var novel = state.novels.find(function (item) {
    return item.id === novelId && item.visible !== false;
  });
  if (!novel) {
    return null;
  }
  if (String(novel.poster || "") !== "/api/poster/" + novelId) {
    return null;
  }
  var result = await get(POSTER_PREFIX + novelId, { access: BLOB_ACCESS, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  return {
    mime: result.blob.contentType || "application/octet-stream",
    stream: result.stream
  };
}
