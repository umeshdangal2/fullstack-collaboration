"use strict";

require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const storage = require("./lib/cms-storage");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

const DATA_DIR = path.join(__dirname, "data");
const BLOG_FILE = path.join(DATA_DIR, "blog.json");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const SOCIAL_FILE = path.join(DATA_DIR, "social.json");
const ADMIN_COOKIE = "portfolio_admin";

const LIMITS = {
  title: 200,
  excerpt: 4000,
  description: 4000,
  tags: 300,
  year: 8,
};

function requireProdSecretsForLocal() {
  if (!isProd || require.main !== module) return;
  const sec = process.env.SESSION_SECRET;
  if (!sec || String(sec).length < 32) {
    console.error("FATAL: Production requires SESSION_SECRET (min 32 characters).");
    process.exit(1);
  }
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.error("FATAL: Production requires ADMIN_PASSWORD_HASH (see .env.example).");
    process.exit(1);
  }
}

function sanitizeText(input, maxLen) {
  if (typeof input !== "string") return "";
  let s = input.replace(/\0/g, "").trim();
  s = s.replace(/[<>]/g, "");
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function sanitizeRichText(input, maxLen) {
  if (typeof input !== "string") return "";
  let s = input.replace(/\0/g, "").trim();
  // Remove dangerous tags/attributes but keep safe formatting HTML
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  s = s.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
  s = s.replace(/on\w+\s*=\s*\S+/gi, "");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/<\/?(iframe|object|embed|form|input|button|meta|link|base)[^>]*>/gi, "");
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function sanitizeNotebookHtml(html) {
  if (typeof html !== "string" || !html.trim()) return "";
  const dangerous = /<script\b|on\w+\s*=|javascript:/i;
  if (dangerous.test(html)) return "";
  return html.replace(/<\/?(html|head|body|meta|link|style|iframe|object|embed|form|input|button)[^>]*>/gi, "");
}

function sanitizeNotebookJson(raw) {
  if (!raw) return null;
  let parsed;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    parsed = raw;
  } else {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.cells)) return null;
  // Keep only expected top-level notebook fields to avoid abuse.
  return {
    nbformat: Number(parsed.nbformat) || 4,
    nbformat_minor: Number(parsed.nbformat_minor) || 0,
    metadata: parsed.metadata || {},
    cells: parsed.cells.map(function(c) {
      if (!c || typeof c !== "object") return null;
      return {
        cell_type: c.cell_type || "",
        source: Array.isArray(c.source) ? c.source.slice(0, 1000) : [],
        metadata: c.metadata || {},
        outputs: Array.isArray(c.outputs) ? c.outputs.slice(0, 100) : [],
        execution_count: c.execution_count || null,
      };
    }).filter(Boolean),
  };
}

function normalizeOptionalUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  let t = raw.trim();
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.href;
  } catch {
    return "";
  }
}

function normalizeOptionalImageUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  let t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) {
    return normalizeOptionalUrl(t);
  }
  t = t.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (/^public\//i.test(t)) {
    t = "/" + t.slice(7).replace(/^\/+/, "");
  } else if (!t.startsWith("/")) {
    t = "/" + t.replace(/^\/+/, "");
  }
  t = t.replace(/\/{2,}/g, "/");
  if (t.length > 500 || t.includes("..")) return "";
  const pathOnly = t.split("?")[0].split("#")[0];
  if (pathOnly.length < 2 || !/^\/[\w./%-]+$/i.test(pathOnly)) return "";
  return pathOnly;
}

function normalizeDate(raw) {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

async function readBlog() {
  const data = await storage.readBlog(BLOG_FILE);
  if (!data || !Array.isArray(data.posts)) return { posts: [] };
  return data;
}

async function readProjects() {
  const data = await storage.readProjects(PROJECTS_FILE);
  if (!data || !Array.isArray(data.items)) return { items: [] };
  return data;
}

async function readSocial() {
  const data = await storage.readSocial(SOCIAL_FILE);
  if (!data || typeof data.posts !== "object" || Array.isArray(data.posts)) {
    return { posts: {} };
  }
  return data;
}

function sanitizeCommentText(input, maxLen) {
  if (typeof input !== "string") return "";
  let s = input.replace(/\0/g, "").trim();
  s = s.replace(/<[^>]*>/g, "");
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function normalizePostId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
}

function sortBlogPosts(posts) {
  return [...posts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function slugifyTitle(title) {
  const base = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || "post";
}

function getPostShortId(post) {
  const raw = String((post && post.id) || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return raw ? raw.slice(0, 8) : "entry";
}

function buildBlogSlug(post) {
  return `${slugifyTitle(post && post.title)}-${getPostShortId(post)}`;
}

function withBlogSeoFields(post) {
  const slug = buildBlogSlug(post);
  return {
    ...post,
    slug,
    path: `/blog/${slug}`,
  };
}

function addBlogSeoFields(posts) {
  return (posts || []).map(withBlogSeoFields);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function sortProjects(items) {
  return [...items].sort((a, b) => {
    const y = String(b.year).localeCompare(String(a.year));
    if (y !== 0) return y;
    return String(a.title).localeCompare(String(b.title));
  });
}

async function verifyAdminPassword(plain) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) {
    try {
      return await bcrypt.compare(String(plain), hash);
    } catch {
      return false;
    }
  }
  if (!isProd && process.env.ADMIN_PASSWORD) {
    const a = Buffer.from(String(plain), "utf8");
    const b = Buffer.from(String(process.env.ADMIN_PASSWORD), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  return false;
}

const cookieSecret =
  process.env.SESSION_SECRET ||
  (isProd ? null : "dev-only-insecure-secret-change-for-any-dev-share");

if (isProd && require.main === module && !process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET required in production.");
  process.exit(1);
}

function requireAuth(req, res, next) {
  if (req.signedCookies[ADMIN_COOKIE] === "1") return next();
  return res.status(401).json({ error: "Unauthorized" });
}

function requirePersistence(req, res, next) {
  if (!storage.persistenceAvailable()) {
    return res.status(503).json({
      error:
        "Saving is disabled on Vercel without Redis: add Upstash Redis from Vercel Storage / Marketplace and set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (see .env.example).",
    });
  }
  next();
}

function setAdminCookie(res) {
  res.cookie(ADMIN_COOKIE, "1", {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    signed: true,
    maxAge: 1000 * 60 * 60 * 12,
    path: "/",
  });
}

function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE, { path: "/", signed: true });
}

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser(cookieSecret));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const password = req.body && req.body.password;
  if (typeof password !== "string" || password.length < 1 || password.length > 500) {
    return res.status(400).json({ error: "Invalid request" });
  }
  const ok = await verifyAdminPassword(password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid password" });
  }
  setAdminCookie(res);
  return res.json({ ok: true });
});

app.post("/api/auth/logout", (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/status", (req, res) => {
  res.json({ authenticated: req.signedCookies[ADMIN_COOKIE] === "1" });
});

app.get("/api/public/content", async (req, res, next) => {
  try {
    const [blog, projects] = await Promise.all([readBlog(), readProjects()]);
    res.json({
      blog: addBlogSeoFields(sortBlogPosts(blog.posts)),
      projects: sortProjects(projects.items),
    });
  } catch (e) {
    next(e);
  }
});

app.get("/api/public/social", async (req, res, next) => {
  try {
    const social = await readSocial();
    const posts = {};
    Object.entries(social.posts || {}).forEach(function ([postId, data]) {
      posts[postId] = {
        likes: Number(data.likes || 0),
        commentCount: Array.isArray(data.comments) ? data.comments.length : 0,
      };
    });
    res.json({ posts });
  } catch (e) {
    next(e);
  }
});

app.get("/api/public/social/:postId", async (req, res, next) => {
  try {
    const postId = normalizePostId(req.params.postId);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });
    const social = await readSocial();
    const data = social.posts[postId] || { likes: 0, comments: [] };
    res.json({
      postId,
      likes: Number(data.likes || 0),
      comments: Array.isArray(data.comments) ? data.comments.slice(-50) : [],
    });
  } catch (e) {
    next(e);
  }
});

app.post("/api/public/social/:postId/like", async (req, res, next) => {
  try {
    const postId = normalizePostId(req.params.postId);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });
    const action = req.body && req.body.action === "unlike" ? "unlike" : "like";
    const social = await readSocial();
    const post = social.posts[postId] || { likes: 0, comments: [] };
    post.likes = Math.max(0, Number(post.likes || 0) + (action === "like" ? 1 : -1));
    social.posts[postId] = post;
    await storage.writeSocial(SOCIAL_FILE, social);
    res.json({ likes: post.likes });
  } catch (e) {
    next(e);
  }
});

app.post("/api/public/social/:postId/comment", async (req, res, next) => {
  try {
    const postId = normalizePostId(req.params.postId);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });
    const comment = sanitizeCommentText(req.body && req.body.comment, 1000);
    if (!comment) return res.status(400).json({ error: "Comment cannot be empty" });
    const social = await readSocial();
    const post = social.posts[postId] || { likes: 0, comments: [] };
    post.comments = Array.isArray(post.comments) ? post.comments : [];
    const newComment = {
      id: crypto.randomUUID(),
      text: comment,
      createdAt: new Date().toISOString(),
    };
    post.comments.push(newComment);
    social.posts[postId] = post;
    await storage.writeSocial(SOCIAL_FILE, social);
    res.status(201).json({ comment: newComment, commentCount: post.comments.length });
  } catch (e) {
    next(e);
  }
});

app.get("/api/admin/content", requireAuth, async (req, res, next) => {
  try {
    const [blog, projects] = await Promise.all([readBlog(), readProjects()]);
    res.json({
      blog: addBlogSeoFields(sortBlogPosts(blog.posts)),
      projects: sortProjects(projects.items),
    });
  } catch (e) {
    next(e);
  }
});

app.get("/blog/:slug", async (req, res, next) => {
  try {
    const blog = await readBlog();
    const posts = addBlogSeoFields(sortBlogPosts(blog.posts));
    const post = posts.find((p) => p.slug === req.params.slug);
    if (!post) {
      return res.status(404).send("Not found");
    }

    const siteOrigin = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
    const canonicalUrl = `${siteOrigin}${post.path}`;
    const pageTitle = `${String(post.title || "Blog Post")} | Umesh Dangal`;
    const metaDescription = stripHtml(post.excerpt || "").slice(0, 155);
    const publishedAt = normalizeDate(post.date) || String(post.date || "");
    const imageUrl = post.image && String(post.image).startsWith("/")
      ? `${siteOrigin}${String(post.image)}`
      : String(post.image || `${siteOrigin}/images/profile.jpg`);

    const postBody = post.excerpt || "";
    const plainExcerpt = stripHtml(post.excerpt || "");
    const sourceLink = post.link
      ? `<p><a class="btn btn-secondary" href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer">Read source</a></p>`
      : "";
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: String(post.title || "Blog Post"),
      datePublished: publishedAt,
      dateModified: publishedAt,
      description: plainExcerpt,
      image: [imageUrl],
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      author: {
        "@type": "Person",
        name: "Umesh Dangal",
      },
      publisher: {
        "@type": "Person",
        name: "Umesh Dangal",
      },
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="article:published_time" content="${escapeHtml(publishedAt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <script type="application/ld+json">${serializeJsonLd(jsonLd)}</script>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="logo" href="/" aria-label="Home">UD</a>
      <nav id="site-nav" class="site-nav" aria-label="Primary">
        <ul class="nav-list">
          <li><a href="/#about">About</a></li>
          <li><a href="/projects.html">Projects</a></li>
          <li><a href="/blogs.html">Blog</a></li>
          <li><a href="/#contact">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>
  <main id="main" class="section">
    <article class="container narrow" style="max-width: 760px; margin: 0 auto;">
      <p class="section-intro"><a href="/blogs.html">Back to blog</a></p>
      <h1 class="section-title">${escapeHtml(post.title || "Blog Post")}</h1>
      <p class="blog-date" style="margin-bottom: 1.5rem;">${escapeHtml(publishedAt)}</p>
      ${post.image ? `<figure class="blog-figure"><img class="blog-image" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title || "Blog image")}"></figure>` : ""}
      <div class="blog-excerpt">${postBody}</div>
      ${sourceLink}
    </article>
  </main>
  <script src="/script.js"></script>
</body>
</html>`;

    res.type("html").send(html);
  } catch (e) {
    next(e);
  }
});

app.get("/sitemap.xml", async (req, res, next) => {
  try {
    const siteOrigin = (process.env.SITE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const blog = await readBlog();
    const posts = addBlogSeoFields(sortBlogPosts(blog.posts));

    const staticUrls = [
      { path: "/", changefreq: "weekly", priority: "1.0" },
      { path: "/blogs.html", changefreq: "weekly", priority: "0.9" },
      { path: "/projects.html", changefreq: "weekly", priority: "0.9" },
      { path: "/project.html", changefreq: "monthly", priority: "0.7" },
    ];

    const staticEntries = staticUrls
      .map((u) => {
        return [
          "  <url>",
          `    <loc>${escapeHtml(`${siteOrigin}${u.path}`)}</loc>`,
          `    <changefreq>${u.changefreq}</changefreq>`,
          `    <priority>${u.priority}</priority>`,
          "  </url>",
        ].join("\n");
      })
      .join("\n");

    const postEntries = posts
      .map((p) => {
        const loc = `${siteOrigin}${p.path}`;
        const lastmod = normalizeDate(p.date) || null;
        return [
          "  <url>",
          `    <loc>${escapeHtml(loc)}</loc>`,
          lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
          "    <changefreq>monthly</changefreq>",
          "    <priority>0.8</priority>",
          "  </url>",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      staticEntries,
      postEntries,
      '</urlset>',
    ].join("\n");

    res.type("application/xml").send(xml);
  } catch (e) {
    next(e);
  }
});

const writeGuard = [requireAuth, requirePersistence];

app.post("/api/admin/blog", ...writeGuard, async (req, res, next) => {
  try {
    const title = sanitizeText(req.body.title, LIMITS.title);
    const excerpt = sanitizeRichText(req.body.excerpt, LIMITS.excerpt);
    const link = normalizeOptionalUrl(req.body.link);
    const image = normalizeOptionalImageUrl(req.body.image);
    const date = normalizeDate(req.body.date);
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!date) return res.status(400).json({ error: "Valid date (YYYY-MM-DD) required" });
    const data = await readBlog();
    const post = {
      id: crypto.randomUUID(),
      title,
      excerpt,
      link,
      image,
      date,
    };
    data.posts.push(post);
    await storage.writeBlog(BLOG_FILE, data);
    res.status(201).json({ post });
  } catch (e) {
    next(e);
  }
});

app.put("/api/admin/blog/:id", ...writeGuard, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== "string" || id.length > 80) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const title = sanitizeText(req.body.title, LIMITS.title);
    const excerpt = sanitizeRichText(req.body.excerpt, LIMITS.excerpt);
    const link = normalizeOptionalUrl(req.body.link);
    const image = normalizeOptionalImageUrl(req.body.image);
    const date = normalizeDate(req.body.date);
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!date) return res.status(400).json({ error: "Valid date (YYYY-MM-DD) required" });
    const data = await readBlog();
    const idx = data.posts.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    data.posts[idx] = { ...data.posts[idx], title, excerpt, link, image, date };
    await storage.writeBlog(BLOG_FILE, data);
    res.json({ post: data.posts[idx] });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/admin/blog/:id", ...writeGuard, async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = await readBlog();
    const nextPosts = data.posts.filter((p) => p.id !== id);
    if (nextPosts.length === data.posts.length) return res.status(404).json({ error: "Not found" });
    data.posts = nextPosts;
    await storage.writeBlog(BLOG_FILE, data);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.post("/api/admin/projects", ...writeGuard, async (req, res, next) => {
  try {
    console.log('POST /api/admin/projects body:', req.body);
    const year = sanitizeText(req.body.year, LIMITS.year);
    const title = sanitizeText(req.body.title, LIMITS.title);
    const description = sanitizeText(req.body.description, LIMITS.description);
    const details = sanitizeRichText(req.body.details || "", 10000);
    const tags = sanitizeText(req.body.tags, LIMITS.tags);
    const url = normalizeOptionalUrl(req.body.url);
    const notebook = normalizeOptionalUrl(req.body.notebook);
    const notebookHtml = sanitizeNotebookHtml(req.body.notebookHtml);
    const notebookJson = sanitizeNotebookJson(req.body.notebookJson);
    if (!year) return res.status(400).json({ error: "Year is required" });
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!description) return res.status(400).json({ error: "Description is required" });
    const data = await readProjects();
    const item = {
      id: crypto.randomUUID(),
      year,
      title,
      description,
      details,
      tags,
      url,
      notebook,
      notebook_html: notebookHtml,
      notebook_json: notebookJson,
    };
    data.items.push(item);
    await storage.writeProjects(PROJECTS_FILE, data);
    res.status(201).json({ project: item });
  } catch (e) {
    next(e);
  }
});

app.put("/api/admin/projects/:id", ...writeGuard, async (req, res, next) => {
  try {
    console.log('PUT /api/admin/projects/' + req.params.id + ' body:', req.body);
    const id = req.params.id;
    if (!id || typeof id !== "string" || id.length > 80) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const year = sanitizeText(req.body.year, LIMITS.year);
    const title = sanitizeText(req.body.title, LIMITS.title);
    const description = sanitizeText(req.body.description, LIMITS.description);
    const details = sanitizeRichText(req.body.details || "", 10000);
    const tags = sanitizeText(req.body.tags, LIMITS.tags);
    const url = normalizeOptionalUrl(req.body.url);
    const notebook = normalizeOptionalUrl(req.body.notebook);
    const notebookHtml = sanitizeNotebookHtml(req.body.notebookHtml);
    const notebookJson = sanitizeNotebookJson(req.body.notebookJson);
    if (!year) return res.status(400).json({ error: "Year is required" });
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!description) return res.status(400).json({ error: "Description is required" });
    const data = await readProjects();
    const idx = data.items.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    data.items[idx] = {
      ...data.items[idx],
      year,
      title,
      description,
      details,
      tags,
      url,
      notebook,
      notebook_html: notebookHtml,
      notebook_json: notebookJson,
    };
    await storage.writeProjects(PROJECTS_FILE, data);
    res.json({ project: data.items[idx] });
  } catch (e) {
    next(e);
  }
});



app.delete("/api/admin/projects/:id", ...writeGuard, async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = await readProjects();
    const nextItems = data.items.filter((p) => p.id !== id);
    if (nextItems.length === data.items.length) return res.status(404).json({ error: "Not found" });
    data.items = nextItems;
    await storage.writeProjects(PROJECTS_FILE, data);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "private", "admin.html"));
});

app.use(express.static(path.join(__dirname, "public"), { index: "index.html" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

requireProdSecretsForLocal();

if (require.main === module) {
  const fs = require("fs/promises");
  fs.mkdir(DATA_DIR, { recursive: true })
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Portfolio server at http://localhost:${PORT}`);
        console.log(`Admin: http://localhost:${PORT}/admin`);
        if (!isProd && !process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD) {
          console.warn(
            "WARN: Set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD (dev only) in .env to enable admin login."
          );
        }
      });
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = app;
