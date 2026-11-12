"use strict";

var MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value) {
  var date = parseDate(value);
  if (!date) {
    return "Belum diatur";
  }
  return date.getDate() + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  var date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + "T00:00:00")
    : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function statusLabel(novel) {
  return novel.status === "Completed" ? "Tamat" : "Sedang Berjalan";
}

function looksLikeHtml(value) {
  return /<\/?(p|blockquote|div|span|em|strong|br|h[1-6])\b/i.test(String(value || ""));
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|blockquote|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#0*39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textToHtml(value) {
  var text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return '<p class="chapter-note">Naskah bab ini belum diisi.</p>';
  }

  var paragraphs = text.split(/\n\s*\n/).map(function (paragraph) {
    return paragraph.trim();
  }).filter(Boolean);

  var hasOpening = false;
  return paragraphs.map(function (paragraph, index) {
    var classes = [];
    var body = escapeHtml(paragraph).replace(/\n/g, "<br>");

    if (index === 0 && /^[\u201c"]/.test(paragraph)) {
      return '<blockquote class="chapter-epigraph"><p>' + body + "</p></blockquote>";
    }

    if (!hasOpening) {
      classes.push("chapter-opening");
      hasOpening = true;
    }

    if (/^bersambung\.?\.?\.?$/i.test(paragraph)) {
      classes = ["chapter-continued"];
    }

    return "<p" + (classes.length ? ' class="' + classes.join(" ") + '"' : "") + ">" + body + "</p>";
  }).join("\n\n");
}

function renderChapterBody(content) {
  var value = String(content || "").trim();
  if (!value) {
    return '<p class="chapter-note">Naskah bab ini belum diisi.</p>';
  }
  return looksLikeHtml(value) ? value : textToHtml(value);
}

function renderParagraphs(value) {
  var text = String(value || "").trim();
  if (!text) {
    return "<p>Sinopsis untuk novel ini belum ditambahkan.</p>";
  }
  if (looksLikeHtml(text)) {
    return text;
  }
  return text.split(/\n\s*\n/).map(function (paragraph) {
    return "<p>" + escapeHtml(paragraph.trim()).replace(/\n/g, "<br>") + "</p>";
  }).join("\n");
}

function descriptionFor(value, limit) {
  var text = stripHtml(value).replace(/\s+/g, " ").trim();
  if (text.length > limit) {
    text = text.slice(0, limit - 1).replace(/\s+\S*$/, "") + "…";
  }
  return text;
}

function posterPath(novel) {
  var poster = String((novel && novel.poster) || "").replace(/\\/g, "/");
  if (!poster) {
    return "assets/images/connvel-book.jpg";
  }
  if (poster.indexOf("data:") === 0) {
    return poster;
  }
  return poster.replace(/^(\.\.\/)+/, "").replace(/^\//, "");
}

function novelHref(novel, prefix) {
  return (prefix || "") + "novel/" + encodeURIComponent(novel.id) + ".html";
}

function chapterHref(novel, chapter, prefix) {
  return (prefix || "") + "ceritanovel/" + encodeURIComponent(novel.id) + "/bab-" + Number(chapter.number) + ".html";
}

var BRAND_SVG = '<svg class="brand-mark" viewBox="0 0 36 36" aria-hidden="true" focusable="false">' +
  '<rect width="36" height="36" rx="11" fill="currentColor"/>' +
  '<path d="M9.5 12.3c3.3-1.4 5.9-1.1 8.5 1 2.6-2.1 5.2-2.4 8.5-1v11.5c-3.3-1.2-5.9-.9-8.5 1.2-2.6-2.1-5.2-2.4-8.5-1.2V12.3Z" fill="#F7F1E6"/>' +
  '<path d="M18 13.2v11.4" stroke="#B45A3A" stroke-width="1.8" stroke-linecap="round"/>' +
  "</svg>";

var BRAND_SVG_FOOTER = '<svg class="brand-mark" viewBox="0 0 36 36" aria-hidden="true" focusable="false">' +
  '<rect width="36" height="36" rx="11" fill="currentColor"/>' +
  '<path d="M9.5 12.3c3.3-1.4 5.9-1.1 8.5 1 2.6-2.1 5.2-2.4 8.5-1v11.5c-3.3-1.2-5.9-.9-8.5 1.2-2.6-2.1-5.2-2.4-8.5-1.2V12.3Z" fill="#241C16"/>' +
  '<path d="M18 13.2v11.4" stroke="#E9BE9E" stroke-width="1.8" stroke-linecap="round"/>' +
  "</svg>";

var SPRITE_SVG = '<svg class="svg-sprite" aria-hidden="true" focusable="false">' +
  '<symbol id="icon-spark" viewBox="0 0 24 24"><path d="M12 1.8c.7 5.5 4.7 9.5 10.2 10.2-5.5.7-9.5 4.7-10.2 10.2C11.3 16.7 7.3 12.7 1.8 12 7.3 11.3 11.3 7.3 12 1.8Z"/></symbol>' +
  '<symbol id="icon-arrow-right" viewBox="0 0 24 24"><path d="M4.5 12h15M13.5 6l6 6-6 6"/></symbol>' +
  '<symbol id="icon-arrow-up-right" viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></symbol>' +
  '<symbol id="icon-chevron-left" viewBox="0 0 24 24"><path d="M14.5 6 8.5 12l6 6"/></symbol>' +
  '<symbol id="icon-chevron-right" viewBox="0 0 24 24"><path d="m9.5 6 6 6-6 6"/></symbol>' +
  '<symbol id="icon-bookmark" viewBox="0 0 24 24"><path d="M6.5 4h11a1 1 0 0 1 1 1v15.5l-6.5-4.4-6.5 4.4V5a1 1 0 0 1 1-1Z"/></symbol>' +
  '<symbol id="icon-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7"/></symbol>' +
  "</svg>";

function siteHeader() {
  return '<header class="site-header" id="top">' +
    '<div class="container header-inner">' +
    '<a class="brand" href="../index.html" aria-label="Connvel — beranda">' + BRAND_SVG +
    '<span class="brand-name">Connvel<span class="brand-dot">.</span></span></a>' +
    '<nav class="main-nav" aria-label="Utama">' +
    '<a class="nav-link" href="../index.html">Beranda</a>' +
    '<a class="nav-link is-active" href="../browse.html" aria-current="page">Jelajahi</a>' +
    '<a class="nav-link" href="../novelis/ruang-tulis.html">Menulis</a>' +
    '<a class="nav-link" href="../tentang/about.html">Tentang Connvel</a>' +
    "</nav>" +
    '<div class="header-actions">' +
    '<a class="btn btn-primary btn-small" href="../info/index.html">Pengumuman</a>' +
    "</div>" +
    '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu">' +
    '<span class="menu-label">Menu</span><span class="menu-icon" aria-hidden="true"><span></span><span></span></span>' +
    "</button></div></header>" +
    '<div class="mobile-menu" id="mobile-menu" aria-hidden="true" inert>' +
    '<nav class="mobile-nav" aria-label="Navigasi utama seluler">' +
    '<a href="../index.html"><span>01</span>Beranda</a>' +
    '<a href="../browse.html"><span>02</span>Jelajahi</a>' +
    '<a href="../novelis/ruang-tulis.html"><span>03</span>Menulis</a>' +
    '<a href="../tentang/about.html"><span>04</span>Tentang Connvel</a>' +
    "</nav>" +
    '<div class="mobile-menu-foot"><div class="mobile-actions">' +
    '<a class="btn btn-primary" href="../info/index.html">Pengumuman</a>' +
    '</div><p class="mobile-motto">Cerita yang menghubungkan dunia.</p></div></div>';
}

function siteFooter() {
  return '<footer class="site-footer"><div class="container footer-grid">' +
    '<div class="footer-brand">' +
    '<a class="brand brand-footer" href="../index.html" aria-label="Connvel — beranda">' + BRAND_SVG_FOOTER +
    '<span class="brand-name">Connvel<span class="brand-dot">.</span></span></a>' +
    '<p class="footer-tagline">Connvel bukan hanya tentang halaman dan kata-kata. Ini tentang cerita yang mempertemukan imajinasi, penulis, dan pembaca dalam satu dunia.</p>' +
    "</div>" +
    '<nav class="footer-col" aria-label="Community"><h3>Community</h3>' +
    '<a href="#">Instagram</a><a href="#">TikTok</a><a href="#">X</a></nav>' +
    '<nav class="footer-col" aria-label="Platform"><h3>Platform</h3>' +
    '<a href="../index.html">Beranda</a><a href="../browse.html">Jelajahi</a>' +
    '<a href="../novelis/ruang-tulis.html">Menulis</a><a href="../tentang/about.html">Tentang Connvel</a></nav>' +
    '<nav class="footer-col" aria-label="Support us"><h3>Support us</h3>' +
    '<a href="../donate.html">Donate</a></nav></div>' +
    '<div class="container footer-bottom"><p>© 2026 Connvel. Dibuat untuk pembaca, di mana pun.</p></div></footer>';
}

function renderChapterList(novel, chapters) {
  var published = chapters.filter(function (chapter) { return chapter.published; });
  var latestPublished = published.length ? published[published.length - 1] : null;

  if (!chapters.length) {
    return '<p class="empty-inline">Belum ada bab untuk novel ini.</p>';
  }

  return '<ol class="chapter-list">' + chapters.map(function (chapter) {
    var index = String(Number(chapter.number) || 0).padStart(2, "0");
    var badge = "";
    if (latestPublished && latestPublished.id === chapter.id) {
      badge = ' <span class="chapter-badge">Terbaru</span>';
    } else if (!chapter.published) {
      badge = ' <span class="chapter-badge">Draf</span>';
    }

    var inner = '<span class="chapter-index" aria-hidden="true">' + escapeHtml(index) + "</span>" +
      '<span class="chapter-text">' +
      '<span class="chapter-name">' + escapeHtml(chapter.title) + badge + "</span>" +
      '<span class="chapter-date"><time datetime="' + escapeAttr(chapter.date) + '">' +
      escapeHtml(formatDate(chapter.date)) + "</time></span></span>";

    if (chapter.published) {
      return '<li class="chapter-item"><a class="chapter-link" href="' +
        escapeAttr(chapterHref(novel, chapter, "../")) + '" aria-label="Baca Bab ' +
        escapeAttr(chapter.number) + ": " + escapeAttr(chapter.title) + '">' +
        inner + '<span class="chapter-read">Baca <svg class="icon" aria-hidden="true">' +
        '<use href="#icon-arrow-right"/></svg></span></a></li>';
    }

    return '<li class="chapter-item"><div class="chapter-link is-draft" aria-disabled="true">' +
      inner + '<span class="chapter-read">Terkunci</span></div></li>';
  }).join("") + "</ol>";
}

function renderNovelPage(novel, chapters) {
  var title = escapeHtml(novel.title);
  var synopsisText = descriptionFor(novel.synopsis, 170);
  var poster = posterPath(novel);
  var published = chapters.filter(function (chapter) { return chapter.published; });
  var firstPublished = published.length ? published[0] : null;
  var latestPublished = published.length ? published[published.length - 1] : null;
  var totalChapters = Number(novel.chapters) || chapters.length;

  var cta = firstPublished
    ? '<a class="btn btn-primary" href="' + escapeAttr(chapterHref(novel, firstPublished, "../")) + '">Mulai Baca Bab ' +
      escapeHtml(firstPublished.number) + ' <svg class="icon" aria-hidden="true"><use href="#icon-arrow-right"/></svg></a>'
    : '<a class="btn btn-primary" href="#daftar-bab">Lihat Daftar Bab <svg class="icon" aria-hidden="true"><use href="#icon-arrow-right"/></svg></a>';

  return '<!DOCTYPE html>\n<html lang="id">\n<head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>" + title + " — Connvel</title>" +
    '<meta name="description" content="' + escapeAttr("Baca " + novel.title + " karya " + novel.author + " di Connvel. " + synopsisText) + '">' +
    '<meta name="theme-color" content="#F6F0E5">' +
    '<meta property="og:title" content="' + escapeAttr(novel.title + " — Connvel") + '">' +
    '<meta property="og:description" content="' + escapeAttr(synopsisText) + '">' +
    '<meta property="og:type" content="book">' +
    '<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">' +
    '<link rel="preload" href="../assets/fonts/sora.woff2" as="font" type="font/woff2" crossorigin>' +
    '<link rel="preload" href="../assets/fonts/fraunces-normal.woff2" as="font" type="font/woff2" crossorigin>' +
    '<link rel="stylesheet" href="../assets/css/styles.css">' +
    '<link rel="stylesheet" href="../assets/css/sections.css">' +
    '<link rel="stylesheet" href="../assets/css/responsive.css">' +
    '<link rel="stylesheet" href="../assets/css/novel.css">' +
    "<script>document.documentElement.classList.add('js');</script></head><body>" +
    '<a class="skip-link" href="#main">Lompat ke konten</a>' +
    SPRITE_SVG + siteHeader() +
    '<main id="main" tabindex="-1"><section class="novel-detail-hero" aria-labelledby="novel-title">' +
    '<div class="container novel-detail-grid">' +
    '<div class="novel-poster" data-reveal><figure class="novel-poster-frame">' +
    '<img src="../' + escapeAttr(poster) + '" alt="Sampul ' + escapeAttr(novel.title) + '" width="700" height="1050">' +
    "</figure>" +
    '<div class="novel-poster-actions">' +
    '<button class="btn btn-primary novel-poster-action" type="button" data-bookmark aria-pressed="false">' +
    '<svg class="icon" aria-hidden="true"><use href="#icon-bookmark"/></svg><span data-bookmark-label>Simpan ke Perpustakaan</span></button>' +
    '<button class="btn btn-outline novel-poster-action" type="button" data-share>' +
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15V4M8.5 7.5 12 4l3.5 3.5M5 12v7h14v-7"/></svg>Bagikan</button>' +
    '<p class="share-status" data-share-status role="status" aria-live="polite"></p></div></div>' +
    '<div class="novel-detail-info" data-reveal>' +
    '<p class="book-genre novel-detail-genre">' + escapeHtml(novel.genre) + "</p>" +
    '<h1 class="novel-detail-title" id="novel-title">' + title + "</h1>" +
    '<p class="novel-detail-author">oleh <a href="#">' + escapeHtml(novel.author) + "</a></p>" +
    '<dl class="novel-facts">' +
    '<div class="novel-fact"><dt>Total Bab</dt><dd>' + escapeHtml(totalChapters) + " Bab</dd></div>" +
    '<div class="novel-fact"><dt>Status</dt><dd>' + escapeHtml(statusLabel(novel)) + "</dd></div></dl>" +
    '<div class="novel-synopsis"><h2>Sinopsis</h2>' + renderParagraphs(novel.synopsis) + "</div>" +
    '<div class="novel-detail-cta">' + cta +
    '<a class="text-link" href="#diskusi">Lihat diskusi pembaca <svg class="icon" aria-hidden="true"><use href="#icon-arrow-up-right"/></svg></a>' +
    "</div></div></div></section>" +
    '<section class="novel-bottom" aria-label="Daftar bab dan diskusi"><div class="container novel-bottom-grid">' +
    '<section class="chapter-panel" id="daftar-bab" aria-labelledby="chapters-title">' +
    '<div class="chapter-head"><div><p class="eyebrow"><svg class="icon icon-spark" aria-hidden="true"><use href="#icon-spark"/></svg>Arsip cerita</p>' +
    '<h2 id="chapters-title">Daftar Bab</h2></div><p class="chapter-count">' +
    escapeHtml(chapters.length) + " bab · " + escapeHtml(published.length) + " terbit</p></div>" +
    renderChapterList(novel, chapters) + "</section>" +
    '<aside class="discussion-panel" id="diskusi" data-novel-id="' + escapeAttr(novel.id) + '" aria-labelledby="comments-title">' +
    '<p class="eyebrow"><svg class="icon icon-spark" aria-hidden="true"><use href="#icon-spark"/></svg>Ruang baca</p>' +
    '<h2 id="comments-title">Diskusi &amp; Komentar Pembaca</h2>' +
    '<p class="discussion-lead">Bagikan kesan, teori cerita, atau dukungan hangat untuk penulis. Setiap komentar adalah bagian dari cerita.</p>' +
    '<p class="comment-count" data-comment-count role="status" aria-live="polite"></p>' +
    '<form class="comment-form" novalidate>' +
    '<label class="sr-only" for="comment-name">Nama kamu</label>' +
    '<input class="comment-name-input" id="comment-name" name="name" type="text" maxlength="40" autocomplete="name" placeholder="Nama kamu" required>' +
    '<label class="sr-only" for="comment-input">Tulis komentar</label>' +
    '<textarea class="comment-input" id="comment-input" name="comment" rows="4" maxlength="1000" placeholder="Tulis kesan atau teori ceritamu di sini…" required></textarea>' +
    '<div class="comment-form-foot"><span class="comment-hint">Bersikap hangat dan suportif, ya.</span>' +
    '<button class="btn btn-primary" type="submit">Kirim Komentar <svg class="icon" aria-hidden="true"><use href="#icon-arrow-right"/></svg></button></div>' +
    '<p class="form-status comment-status" role="status" aria-live="polite"></p></form>' +
    '<ul class="comment-list" aria-label="Komentar pembaca"></ul>' +
    "</aside></div></section></main>" + siteFooter() +
    '<script src="../assets/js/connvel-store.js" defer></script>' +
    '<script src="../assets/js/main.js" defer></script>' +
    '<script src="../assets/js/novel.js" defer></script></body></html>';
}

function chapterNav(novel, chapter, chapters, position) {
  var index = chapters.findIndex(function (item) { return item.id === chapter.id; });
  var previous = index > 0 ? chapters[index - 1] : null;
  var next = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;
  var previousEnabled = Boolean(previous && previous.published);
  var nextEnabled = Boolean(next && next.published);

  var previousMarkup = previousEnabled
    ? '<a class="chapter-btn" href="bab-' + escapeAttr(previous.number) + '.html">' +
      '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 6 8.5 12l6 6"/></svg>Sebelumnya</a>'
    : '<span class="chapter-btn is-disabled" aria-disabled="true">' +
      '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 6 8.5 12l6 6"/></svg>Sebelumnya</span>';

  var nextMarkup = nextEnabled
    ? '<a class="chapter-btn chapter-btn--next" href="bab-' + escapeAttr(next.number) + '.html">Selanjutnya ' +
      '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m9.5 6 6 6-6 6"/></svg></a>'
    : '<span class="chapter-btn chapter-btn--next is-disabled" aria-disabled="true" title="' +
      escapeAttr(next ? "Bab " + next.number + " belum dirilis" : "Belum ada bab selanjutnya") + '">' +
      'Selanjutnya <svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m9.5 6 6 6-6 6"/></svg></span>';

  return '<div class="chapter-controls">' + previousMarkup + nextMarkup + "</div>";
}

function renderChapterPage(novel, chapter, chapters) {
  var body = renderChapterBody(chapter.content);
  var description = descriptionFor(chapter.content, 165) ||
    ("Baca Bab " + chapter.number + " " + novel.title + " karya " + novel.author + " di Connvel.");
  var title = "Bab " + chapter.number + " — " + chapter.title + " | " + novel.title + " — Connvel";
  var detailHref = "../../novel/" + encodeURIComponent(novel.id) + ".html";

  return '<!DOCTYPE html>\n<html lang="id">\n<head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>" + escapeHtml(title) + "</title>" +
    '<meta name="description" content="' + escapeAttr(description) + '">' +
    '<meta name="theme-color" content="#F6F0E5">' +
    '<meta property="og:title" content="' + escapeAttr("Bab " + chapter.number + " — " + chapter.title + " | " + novel.title) + '">' +
    '<meta property="og:description" content="' + escapeAttr("Baca Bab " + chapter.number + " " + novel.title + " karya " + novel.author + " di Connvel.") + '">' +
    '<meta property="og:type" content="article">' +
    '<link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">' +
    '<link rel="preload" href="../../assets/fonts/sora.woff2" as="font" type="font/woff2" crossorigin>' +
    '<link rel="preload" href="../../assets/fonts/fraunces-normal.woff2" as="font" type="font/woff2" crossorigin>' +
    '<link rel="stylesheet" href="../../assets/css/styles.css">' +
    '<link rel="stylesheet" href="../../assets/css/read.css">' +
    "</head><body>" +
    '<a class="skip-link" href="#chapter-start">Lompat ke isi bacaan</a>' +
    '<header class="reading-bar"><div class="container reading-bar-inner">' +
    '<a class="brand reading-brand" href="../../index.html" aria-label="Connvel — beranda">' + BRAND_SVG +
    '<span class="brand-name">Connvel<span class="brand-dot">.</span></span></a>' +
    '<nav class="reading-nav" aria-label="Navigasi bab">' +
    '<a class="reading-back" href="' + escapeAttr(detailHref) + '">' +
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 6 8.5 12l6 6"/></svg>Kembali ke Detail Novel</a>' +
    chapterNav(novel, chapter, chapters) + "</nav></div></header>" +
    '<main class="reading" id="main"><article class="chapter" aria-labelledby="chapter-title">' +
    '<header class="chapter-header" id="chapter-start">' +
    '<p class="chapter-series">' + escapeHtml(novel.title) + "</p>" +
    '<p class="chapter-author">Oleh ' + escapeHtml(novel.author) + "</p>" +
    '<h1 class="chapter-title" id="chapter-title">Bab ' + escapeHtml(chapter.number) + " — " + escapeHtml(chapter.title) + "</h1>" +
    '</header><div class="chapter-body">' + body + "</div></article>" +
    '<nav class="chapter-end" aria-label="Navigasi akhir bab">' +
    '<a class="reading-back" href="' + escapeAttr(detailHref) + '">' +
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 6 8.5 12l6 6"/></svg>Kembali ke Detail Novel</a>' +
    chapterNav(novel, chapter, chapters) + "</nav></main></body></html>";
}

module.exports = {
  escapeHtml: escapeHtml,
  slugify: slugify,
  formatDate: formatDate,
  stripHtml: stripHtml,
  renderNovelPage: renderNovelPage,
  renderChapterPage: renderChapterPage,
  chapterHref: chapterHref,
  novelHref: novelHref
};
