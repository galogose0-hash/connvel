"use strict";

var render = require("./render");

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
      type: String(candidate.type || "").trim().toLowerCase() === "cerpen" ? "Cerpen" : "Novel",
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

  var legacyAnnouncement = source.announcement && typeof source.announcement === "object"
    ? source.announcement
    : null;
  var announcementCandidates = Array.isArray(source.announcements)
    ? source.announcements
    : legacyAnnouncement
      ? [legacyAnnouncement]
      : [];

  var usedAnnouncementIds = {};
  var announcements = [];

  announcementCandidates.forEach(function (candidate, index) {
    if (!candidate || typeof candidate !== "object") {
      return;
    }
    var title = String(candidate.title || "").trim();
    if (!title) {
      return;
    }
    var desiredId = String(candidate.id || "").trim() || "ann-" + (index + 1);
    var id = desiredId;
    var suffix = 2;
    while (usedAnnouncementIds[id]) {
      id = desiredId + "-" + suffix;
      suffix += 1;
    }
    usedAnnouncementIds[id] = true;

    announcements.push({
      id: id,
      title: title,
      body: String(candidate.body || "").trim(),
      date: String(candidate.date || "").slice(0, 10),
      visible: candidate.visible !== false
    });
  });

  announcements.sort(function (a, b) {
    if (a.date === b.date) {
      return 0;
    }
    if (!a.date) {
      return 1;
    }
    if (!b.date) {
      return -1;
    }
    return a.date < b.date ? 1 : -1;
  });

  return {
    novels: novels,
    chapters: chapters,
    home: {
      spotlight: spotlight,
      latest: latest,
      trending: trending
    },
    announcements: announcements,
    submissions: submissions,
    comments: comments
  };
}

module.exports = {
  normalizeState: normalizeState
};
