import { randomBytes } from "node:crypto";
import { normalizeState } from "../../server/normalize.js";
import {
  openStore,
  readState,
  writeState,
  isAuthorized,
  hasAuthHeader,
  sanitizeState,
  persistPosters,
  readPoster
} from "./shared/state.mjs";

const MAX_BODY = 6 * 1024 * 1024;

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function fail(status, message) {
  return json({ error: message }, status);
}

function httpError(status, message) {
  var error = new Error(message);
  error.status = status;
  return error;
}

async function readJsonBody(request) {
  var raw = await request.text();
  if (raw.length > MAX_BODY) {
    throw httpError(413, "Data terlalu besar. Maksimal 6 MB.");
  }
  if (!raw || !raw.trim()) {
    throw httpError(400, "Body JSON kosong.");
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw httpError(400, "Body JSON tidak valid.");
  }
}

function randomSuffix() {
  return Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
}

async function handleGetState(request) {
  if (hasAuthHeader(request) && !isAuthorized(request)) {
    return fail(401, "Kunci admin tidak valid. Periksa kembali.");
  }
  var store = await openStore();
  var state = await readState(store);
  if (isAuthorized(request)) {
    return json({ state: state });
  }
  return json({ state: sanitizeState(state) });
}

async function handlePutState(request) {
  if (!isAuthorized(request)) {
    return fail(401, "Kunci admin tidak valid. Periksa kembali.");
  }
  var payload = await readJsonBody(request);
  var candidate = payload && payload.state ? payload.state : payload;
  var store = await openStore();
  var state = normalizeState(candidate);
  await persistPosters(store, state);
  await writeState(store, state);
  return json({ state: state });
}

async function handleComment(request) {
  var payload = await readJsonBody(request);
  var store = await openStore();
  var state = await readState(store);

  var novelId = String((payload && payload.novelId) || "");
  var novel = state.novels.find(function (item) { return item.id === novelId; });
  if (!novel) {
    throw httpError(404, "Novel tidak ditemukan.");
  }

  var name = String((payload && payload.name) || "").trim().slice(0, 40);
  var message = String((payload && payload.message) || "").trim().slice(0, 1000);
  if (!name) {
    throw httpError(400, "Nama wajib diisi.");
  }
  if (!message) {
    throw httpError(400, "Komentar wajib diisi.");
  }

  var comment = {
    id: "com-" + randomSuffix(),
    novelId: novelId,
    name: name,
    message: message,
    date: new Date().toISOString()
  };
  state.comments = Array.isArray(state.comments) ? state.comments : [];
  state.comments.push(comment);
  await writeState(store, state);
  return json({ comment: comment }, 201);
}

async function handleSubmission(request) {
  var payload = await readJsonBody(request) || {};
  var store = await openStore();
  var state = await readState(store);

  var name = String(payload.name || payload.author_name || "").trim().slice(0, 80);
  var email = String(payload.email || "").trim().slice(0, 160);
  var phone = String(payload.phone || payload.whatsapp || "").trim().slice(0, 30);
  var novelTitle = String(payload.novelTitle || payload.novel_title || "").trim().slice(0, 140);
  var chapter = String(payload.chapter || payload.chapter_info || "").trim().slice(0, 100);
  var message = String(payload.message || payload.content || "").trim().slice(0, 20000);

  if (!name) {
    throw httpError(400, "Nama penulis wajib diisi.");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw httpError(400, "Alamat email tidak valid.");
  }
  if (phone.replace(/\D/g, "").length < 8) {
    throw httpError(400, "Nomor WhatsApp tidak valid.");
  }
  if (!novelTitle) {
    throw httpError(400, "Judul novel wajib diisi.");
  }
  if (!chapter) {
    throw httpError(400, "Bab / episode wajib diisi.");
  }
  if (!message) {
    throw httpError(400, "Isi cerita wajib diisi.");
  }

  var submission = {
    id: "sub-" + randomSuffix(),
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
  await writeState(store, state);
  return json({ submission: submission }, 201);
}

export default async (request) => {
  var url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return fail(400, "Alamat tidak valid.");
  }

  var pathname = url.pathname;
  var method = request.method;

  try {
    if (method === "GET" && pathname === "/api/health") {
      return json({ ok: true, data: true });
    }

    if (method === "GET" && pathname === "/api/state") {
      return await handleGetState(request);
    }

    if (method === "PUT" && pathname === "/api/state") {
      return await handlePutState(request);
    }

    if (method === "POST" && pathname === "/api/comments") {
      return await handleComment(request);
    }

    if (method === "POST" && pathname === "/api/submissions") {
      return await handleSubmission(request);
    }

    if (method === "GET" && pathname.indexOf("/api/poster/") === 0) {
      var novelId = pathname.slice("/api/poster/".length);
      try {
        novelId = decodeURIComponent(novelId);
      } catch (error) {
        return fail(404, "Poster tidak ditemukan.");
      }
      var store = await openStore();
      var poster = await readPoster(store, novelId);
      if (!poster) {
        return fail(404, "Poster tidak ditemukan.");
      }
      return new Response(poster.bytes, {
        status: 200,
        headers: {
          "Content-Type": poster.mime,
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    return fail(404, "Endpoint API tidak ditemukan.");
  } catch (error) {
    return fail(error.status || 500, error.message || "Kesalahan server.");
  }
};
