import render from "../../server/render.js";
import { openStore, readState } from "./shared/state.mjs";

function html(markup) {
  return new Response(markup, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}

function notFound() {
  var markup = '<!DOCTYPE html>\n<html lang="id">\n<head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>Halaman tidak ditemukan — Connvel</title>" +
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">' +
    '<link rel="stylesheet" href="/assets/css/styles.css"></head>' +
    '<body class="error-page"><main class="error-shell" style="max-width:32rem;margin:0 auto;padding:6rem 1.5rem;text-align:center;">' +
    '<p style="font-size:0.8rem;letter-spacing:0.18em;text-transform:uppercase;color:#B45A3A;">404</p>' +
    '<h1 style="font-size:2rem;margin:0.5rem 0 1rem;">Halaman tidak ditemukan</h1>' +
    '<p style="color:#6B6258;">Cerita yang kamu cari mungkin sudah dipindahkan atau belum diterbitkan.</p>' +
    '<a class="btn btn-primary" href="/">Kembali ke Beranda</a>' +
    "</main></body></html>";
  return new Response(markup, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}

export default async (request) => {
  var url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return notFound();
  }

  var pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (error) {
    return notFound();
  }

  var novelMatch = /^\/novel\/([^\/]+)\.html$/.exec(pathname);
  var chapterMatch = /^\/ceritanovel\/([^\/]+)\/bab-(\d+)\.html$/.exec(pathname);

  if (!novelMatch && !chapterMatch) {
    return notFound();
  }

  var novelId = novelMatch ? novelMatch[1] : chapterMatch[1];
  var store = await openStore();
  var state = await readState(store);
  var novel = state.novels.find(function (item) {
    return item.id === novelId && item.visible !== false;
  });

  if (!novel) {
    return notFound();
  }

  var chapters = state.chapters
    .filter(function (chapter) { return chapter.novelId === novel.id; })
    .slice()
    .sort(function (a, b) { return a.number - b.number; });

  if (novelMatch) {
    return html(render.renderNovelPage(novel, chapters));
  }

  var number = parseInt(chapterMatch[2], 10);
  var chapter = chapters.find(function (item) {
    return Number(item.number) === number && item.published;
  });

  if (!chapter) {
    return notFound();
  }

  return html(render.renderChapterPage(novel, chapter, chapters));
};
