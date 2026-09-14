// Loads editable content (content/*.json, managed via /admin) into the static pages.
// Requires the site to be served over http(s) — fetch() of local JSON does not work
// when a page is opened directly as a file:// URL.

(function () {
  "use strict";

  function rootPath() {
    // blog-post.html and index.html live at the site root; admin pages are nested.
    return "";
  }

  function fetchJSON(path) {
    return fetch(rootPath() + path, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + path);
      return res.json();
    });
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return iso; }
  }

  // Very small markdown-ish renderer: paragraphs, *italic*, blank-line breaks.
  // Keeps things dependency-free for a simple blog body.
  function renderBody(md) {
    var escaped = escapeHTML(md || "");
    var withEm = escaped.replace(/\*(.+?)\*/g, "<em>$1</em>");
    var paragraphs = withEm.split(/\n\s*\n/).map(function (p) {
      return "<p>" + p.trim().replace(/\n/g, "<br>") + "</p>";
    });
    return paragraphs.join("\n");
  }

  /* ---------------- Site settings (contact / social links) ---------------- */
  function renderSettings() {
    var fields = document.querySelectorAll("[data-cms-field]");
    fetchJSON("content/settings.json").then(function (settings) {
      window.__siteSettings = settings;
      fields.forEach(function (el) {
        var key = el.getAttribute("data-cms-field");
        var value = settings[key];
        if (!value) return; // keep placeholder + badge as-is
        if (key === "email") {
          el.setAttribute("href", "mailto:" + value);
          el.textContent = value;
        } else if (key === "address") {
          el.innerHTML = escapeHTML(value).replace(/\n/g, "<br>");
          return; // badge was a child of el — already gone with the innerHTML swap
        } else {
          el.setAttribute("href", value);
        }
        // The "add link / edit me" badge sits right after its field element in the markup.
        var badge = el.nextElementSibling;
        if (badge && badge.getAttribute("data-cms-badge") === key) badge.remove();
      });
    }).catch(function () { /* settings not reachable (e.g. opened via file://) */ });
  }

  /* ---------------- Blog listing (blog.html) ---------------- */
  function renderBlogList() {
    var container = document.querySelector("#blog-list");
    if (!container) return;
    fetchJSON("content/blog.json").then(function (data) {
      var posts = (data.posts || [])
        .filter(function (p) { return !p.draft; })
        .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

      if (!posts.length) {
        container.innerHTML = '<p class="muted">No posts published yet — add one in the <a href="admin/">admin panel</a>.</p>';
        return;
      }

      container.innerHTML = posts.map(function (p) {
        return (
          '<div class="card post-card reveal is-visible">' +
            '<div class="post-meta">' + escapeHTML(p.category || "Post") + " · " + formatDate(p.date) + "</div>" +
            "<h3>" + escapeHTML(p.title) + "</h3>" +
            "<p>" + escapeHTML(p.excerpt || "") + "</p>" +
            '<a href="blog-post.html?slug=' + encodeURIComponent(p.slug) + '" class="post-link">Read the full post →</a>' +
          "</div>"
        );
      }).join("");
    }).catch(function () {
      container.innerHTML = '<p class="muted">Couldn\'t load posts. If you opened this file directly from disk, run it through a local server (or view it live on Netlify) for the blog to load.</p>';
    });
  }

  /* ---------------- Single blog post (blog-post.html) ---------------- */
  function renderBlogPost() {
    var container = document.querySelector("#post-content");
    if (!container) return;
    var slug = new URLSearchParams(window.location.search).get("slug");
    fetchJSON("content/blog.json").then(function (data) {
      var post = (data.posts || []).find(function (p) { return p.slug === slug && !p.draft; });
      if (!post) {
        container.innerHTML = "<h1>Post not found</h1><p class=\"muted\">This post may have been unpublished or the link is out of date.</p>";
        document.title = "Post not found — Shripama Thounaojam";
        return;
      }
      document.title = post.title + " — Shripama Thounaojam";
      container.innerHTML =
        '<div class="kicker">' + escapeHTML(post.category || "Post") + "</div>" +
        "<h1>" + escapeHTML(post.title) + "</h1>" +
        '<p class="muted">' + formatDate(post.date) + "</p>" +
        '<article class="prose" style="margin-top:24px;">' + renderBody(post.body) + "</article>";
    }).catch(function () {
      container.innerHTML = "<p class=\"muted\">Couldn't load this post. Try viewing the site through a local server or its live Netlify URL.</p>";
    });
  }

  /* ---------------- Publications (publications.html) ---------------- */
  function renderPublications() {
    var journalBody = document.querySelector("#journal-articles-body");
    var confBody = document.querySelector("#conferences-body");
    if (!journalBody && !confBody) return;

    fetchJSON("content/publications.json").then(function (data) {
      if (journalBody) {
        journalBody.innerHTML = (data.journalArticles || []).map(function (a) {
          var statusClass = /accept|publish/i.test(a.status) ? "status-accepted" : "muted";
          return (
            "<tr><td>" + escapeHTML(a.title) + "</td><td>" + escapeHTML(a.journal) + "</td><td>" +
            escapeHTML(a.authors) + '</td><td class="' + statusClass + '">' + escapeHTML(a.status) + "</td></tr>"
          );
        }).join("");
      }
      if (confBody) {
        confBody.innerHTML = (data.conferences || []).map(function (c) {
          return (
            "<tr><td>" + escapeHTML(c.date) + "</td><td>" + escapeHTML(c.title) + "</td><td>" +
            escapeHTML(c.type) + "</td><td>" + escapeHTML(c.organiser) + '</td><td class="status-presented">' +
            escapeHTML(c.status) + "</td></tr>"
          );
        }).join("");
      }
    }).catch(function () { /* leave the server-rendered fallback rows in place */ });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderSettings();
    renderBlogList();
    renderBlogPost();
    renderPublications();
  });
})();
