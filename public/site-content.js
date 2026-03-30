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
        .map(function (p, index) {
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
            '<li class="project-card" data-index="' + index + '">' +
            '<div class="card-top">' +
            '<h3 class="project-title">' +
            titleInner +
            "</h3>" +
            '<button type="button" class="card-more" aria-label="Project actions" disabled>⋯</button>' +
            '</div>' +
            '<span class="project-year">' +
            escapeHtml(p.year || "") +
            "</span>" +
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
        .map(function (post, index) {
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
          var postId = 'blog-' + index;
          return (
            '<li class="blog-item" data-index="' + index + '" id="' + postId + '">' +
            '<div class="card-top">' +
            '<h3 class="blog-title"><a href="' +
            href +
            '">' +
            title +
            "</a></h3>" +
            '<button type="button" class="card-more" aria-label="Blog actions" disabled>⋯</button>' +
            '</div>' +
            '<p class="blog-date" datetime="' +
            escapeHtml(post.date || "") +
            '">' +
            formatBlogDate(post.date) +
            "</p>" +
            '<p class="blog-excerpt">' +
            escapeHtml(post.excerpt || "") +
            "</p>" +
            imgBlock +
            '<div class="social-bar">' +
            '<button type="button" class="social-like" data-post="' + postId + '">👍 Like</button>' +
            '<button type="button" class="social-comment" data-post="' + postId + '">💬 Comment</button>' +
            '<button type="button" class="social-share" data-post="' + postId + '">📤 Share</button>' +
            '</div>' +
            '<div class="comment-section" id="comments-' + postId + '" style="display:none;">' +
            '<textarea class="comment-input" placeholder="Write a comment..."></textarea>' +
            '<button type="button" class="comment-submit">Post Comment</button>' +
            '<div class="comments-list"></div>' +
            '</div>' +
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

      function initProjectCarousel() {
        var carousel = document.querySelector(".project-carousel");
        if (!carousel) return;

        var cards = carousel.querySelectorAll(".project-card");
        if (!cards.length || cards.length < 2) return;

        // Add controls
        var controls = document.createElement("div");
        controls.className = "carousel-controls";
        controls.innerHTML = '<button class="carousel-prev" aria-label="Previous">‹</button>' +
                             '<div class="carousel-dots"></div>' +
                             '<button class="carousel-next" aria-label="Next">›</button>';
        carousel.appendChild(controls);

        var dotsContainer = controls.querySelector(".carousel-dots");
        cards.forEach(function (_, index) {
          var dot = document.createElement("button");
          dot.className = "carousel-dot";
          dot.setAttribute("data-index", index);
          dot.setAttribute("aria-label", "Go to slide " + (index + 1));
          dotsContainer.appendChild(dot);
        });

        var current = 0;
        var timer = null;

        function goTo(index) {
          var card = cards[index];
          if (!card) return;
          carousel.scrollTo({
            left: card.offsetLeft - 8,
            behavior: "smooth",
          });
          // Update dots
          dotsContainer.querySelectorAll(".carousel-dot").forEach(function (d, i) {
            d.classList.toggle("active", i === index);
          });
        }

        function start() {
          timer = setInterval(function () {
            current = (current + 1) % cards.length;
            goTo(current);
          }, 6000);
        }

        function stop() {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }

        carousel.addEventListener("mouseenter", stop);
        carousel.addEventListener("mouseleave", start);

        start();
      }

      initProjectCarousel();

      document.addEventListener("click", function (event) {
        var button = event.target;
        if (!(button instanceof HTMLElement)) return;

        if (button.matches(".social-like")) {
          var postId = button.getAttribute("data-post");
          var likedKey = "liked-" + postId;
          if (localStorage.getItem(likedKey)) {
            alert("You already liked this post.");
            return;
          }
          localStorage.setItem(likedKey, "true");
          button.classList.add("liked");
          button.textContent = "👍 Liked";
          return;
        }

        if (button.matches(".social-comment")) {
          var postId = button.getAttribute("data-post");
          var commentSection = document.getElementById("comments-" + postId);
          if (commentSection) {
            commentSection.style.display = commentSection.style.display === "none" ? "block" : "none";
          }
          return;
        }

        if (button.matches(".social-share")) {
          var postId = button.getAttribute("data-post");
          var blogUrl = window.location.href + "#" + postId;
          navigator.clipboard
            .writeText(blogUrl)
            .then(function () {
              alert("Blog link copied to clipboard.");
            })
            .catch(function () {
              window.prompt("Copy this URL", blogUrl);
            });
          return;
        }

        if (button.matches(".comment-submit")) {
          var commentSection = button.closest(".comment-section");
          var input = commentSection.querySelector(".comment-input");
          var list = commentSection.querySelector(".comments-list");
          var comment = input.value.trim();
          if (comment) {
            var commentEl = document.createElement("div");
            commentEl.className = "comment";
            commentEl.textContent = comment;
            list.appendChild(commentEl);
            input.value = "";
          }
          return;
        }

        // Carousel controls
        if (button.matches(".carousel-prev")) {
          var carousel = document.querySelector(".project-carousel");
          var cards = carousel.querySelectorAll(".project-card");
          if (cards.length) {
            var current = Math.floor(carousel.scrollLeft / cards[0].offsetWidth);
            var next = current > 0 ? current - 1 : cards.length - 1;
            carousel.scrollTo({ left: cards[next].offsetLeft - 8, behavior: "smooth" });
          }
          return;
        }

        if (button.matches(".carousel-next")) {
          var carousel = document.querySelector(".project-carousel");
          var cards = carousel.querySelectorAll(".project-card");
          if (cards.length) {
            var current = Math.floor(carousel.scrollLeft / cards[0].offsetWidth);
            var next = current < cards.length - 1 ? current + 1 : 0;
            carousel.scrollTo({ left: cards[next].offsetLeft - 8, behavior: "smooth" });
          }
          return;
        }

        if (button.matches(".carousel-dot")) {
          var index = parseInt(button.getAttribute("data-index"));
          var carousel = document.querySelector(".project-carousel");
          var cards = carousel.querySelectorAll(".project-card");
          if (cards[index]) {
            carousel.scrollTo({ left: cards[index].offsetLeft - 8, behavior: "smooth" });
          }
          return;
        }
      });

    })
    .catch(function () {
      showStatus(projectsStatus, "Couldn’t load projects. Refresh or try again later.", true);
      showStatus(blogStatus, "Couldn’t load blog posts.", true);
    });
})();
