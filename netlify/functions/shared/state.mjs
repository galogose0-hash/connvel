import { getStore } from "@netlify/blobs";
import seedState from "./seed-state.mjs";
import { normalizeState } from "../../../server/normalize.js";

const STORE_NAME = "connvel";
const STATE_KEY = "state";
const POSTER_PREFIX = "poster:";
const MAX_POSTER_BYTES = 4 * 1024 * 1024;

var storeFactory = null;

export function setStoreFactory(factory) {
  storeFactory = factory;
}

export async function openStore() {
  if (storeFactory) {
    return await storeFactory();
  }
  return await getStore(STORE_NAME);
}

export async function readState(store) {
  var raw = await store.get(STATE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      /* Data rusak ditimpa ulang dari seed di bawah. */
    }
  }
  var seeded = normalizeState(seedState);
  await writeState(store, seeded);
  return seeded;
}

export async function writeState(store, state) {
  await store.set(STATE_KEY, JSON.stringify(state));
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
        status: novel.status,
        chapters: novel.chapters,
        visible: true,
        poster: posterPublicPath(novel),
        synopsis: novel.synopsis
      };
    });

  return {
    novels: novels,
    home: source.home && typeof source.home === "object" ? source.home : {},
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
    await store.set(POSTER_PREFIX + novel.id, poster);
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
  var raw = await store.get(POSTER_PREFIX + novelId);
  if (!raw) {
    return null;
  }
  var match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(raw);
  if (!match) {
    return null;
  }
  return {
    mime: match[1].toLowerCase(),
    bytes: Buffer.from(match[2], "base64")
  };
}
