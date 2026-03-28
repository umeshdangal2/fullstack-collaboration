(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBlogDate(iso) {
    if (!iso || typeof iso !== "string") return "";
    var parts = iso.split("-");
    if (parts.length !== 3) return escapeHtml(iso);
    var y = Number(parts[0]);
    var m = Number(parts[1]) - 1;
    var d = Number(parts[2]);
    var dt = new Date(Date.UTC(y, m, d));
    if (isNaN(dt.getTime())) return escapeHtml(iso);
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  var projectList = document.getElementById("project-list");
  var blogList = document.getElementById("blog-list");
  var projectsStatus = document.getElementById("projects-status");
  var blogStatus = document.getElementById("blog-status");

  if (!projectList || !blogList) return;

  function showStatus(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("admin-hidden");
    el.style.color = isError ? "#6b2d2d" : "";
  }

  fetch("/api/public/content", { credentials: "same-origin" })
    .then(function (r) {
      if (!r.ok) throw new Error("load");
      return r.json();
    })
    .then(function (data) {
      var projects = data.projects || [];
      var blog = data.blog || [];

      projectList.innerHTML = projects
        .map(function (p) {
          var titleHtml = escapeHtml(p.title || "");
          var titleInner =
            p.url && typeof p.url === "string"
              ? '<a href="' +
                escapeHtml(p.url) +
                '" rel="noopener noreferrer">' +
                titleHtml +
                "</a>"
              : titleHtml;
          return (
            '<li class="project-card">' +
            '<span class="project-year">' +
            escapeHtml(p.year || "") +
            "</span>" +
            '<h3 class="project-title">' +
            titleInner +
            "</h3>" +
            '<p class="project-desc">' +
            escapeHtml(p.description || "") +
            "</p>" +
            '<span class="project-tags">' +
            escapeHtml(p.tags || "") +
            "</span>" +
            "</li>"
          );
        })
        .join("");

      blogList.innerHTML = blog
        .map(function (post) {
          var href = post.link && String(post.link).trim() ? escapeHtml(post.link) : "#";
          var title = escapeHtml(post.title || "");
          var rawImg = post.image && String(post.image).trim() ? String(post.image).trim() : "";
          var imgSrc = rawImg ? escapeHtml(rawImg) : "";
          var imgAlt = escapeHtml(post.title || "Blog image");
          /* no loading="lazy": images live inside .reveal (opacity 0) until scroll; lazy + IO can delay load */
          var imgBlock = imgSrc
            ? '<figure class="blog-figure"><img class="blog-image" src="' +
              imgSrc +
              '" alt="' +
              imgAlt +
              '" decoding="async"></figure>'
            : "";
          return (
            '<li class="blog-item">' +
            '<time class="blog-date" datetime="' +
            escapeHtml(post.date || "") +
            '">' +
            formatBlogDate(post.date) +
            "</time>" +
            imgBlock +
            '<h3 class="blog-title"><a href="' +
            href +
            '">' +
            title +
            "</a></h3>" +
            '<p class="blog-excerpt">' +
            escapeHtml(post.excerpt || "") +
            "</p>" +
            "</li>"
          );
        })
        .join("");

      if (projects.length === 0) {
        showStatus(projectsStatus, "No projects yet — check back soon.", false);
      }
      if (blog.length === 0) {
        showStatus(blogStatus, "No blog posts yet.", false);
      }
    })
    .catch(function () {
      showStatus(projectsStatus, "Couldn’t load projects. Refresh or try again later.", true);
      showStatus(blogStatus, "Couldn’t load blog posts.", true);
    });
})();
