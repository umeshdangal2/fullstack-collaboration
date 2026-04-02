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

  function getLikeCount(postId) {
    return Number(localStorage.getItem('like-count-' + postId) || 0);
  }

  function setLikeCount(postId, count) {
    localStorage.setItem('like-count-' + postId, String(Math.max(0, Math.floor(count))));
  }

  function getCommentCount(postId) {
    return Number(localStorage.getItem('comment-count-' + postId) || 0);
  }

  function setCommentCount(postId, count) {
    localStorage.setItem('comment-count-' + postId, String(Math.max(0, Math.floor(count))));
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
          var detailHref = '/project.html?id=' + encodeURIComponent(p.id);
          return (
            '<li class="project-card" data-index="' + index + '" data-href="' + detailHref + '">' +
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

      projectList.querySelectorAll('.project-card').forEach(function(card) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function() {
          window.location.href = this.dataset.href;
        });
      });

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
          var likeCount = getLikeCount(postId);
          var commentCount = getCommentCount(postId);
          var userLiked = Boolean(localStorage.getItem('liked-' + postId));
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
            '<button type="button" class="social-like ' + (userLiked ? 'liked' : '') + '" data-post="' + postId + '">👍 ' + (userLiked ? 'Liked' : 'Like') + ' (' + likeCount + ')</button>' +
            '<button type="button" class="social-comment" data-post="' + postId + '">💬 Comment (' + commentCount + ')</button>' +
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

        var projectList = carousel.querySelector(".project-list");
        if (!projectList) return;

        var cards = projectList.querySelectorAll(".project-card");
        if (!cards.length || cards.length < 2) return;

        var cardWidth = cards[0].offsetWidth + 15; // Include gap
        var totalCards = cards.length;
        var currentIndex = 0;
        var isAutoPlay = true;
        var timer = null;

        // Clone all cards and append to create infinite effect
        cards.forEach(function(card) {
          var clonedCard = card.cloneNode(true);
          projectList.appendChild(clonedCard);
        });

        // Add additional clones for smooth looping
        cards.forEach(function(card) {
          var clonedCard = card.cloneNode(true);
          projectList.appendChild(clonedCard);
        });

        function updateSlide() {
          var scrollAmount = currentIndex * cardWidth;
          projectList.style.transition = 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
          projectList.style.transform = 'translateX(-' + scrollAmount + 'px)';

          // Reset seamlessly when wrapping around
          if (currentIndex === totalCards) {
            setTimeout(function() {
              projectList.style.transition = 'none';
              currentIndex = 0;
              projectList.style.transform = 'translateX(0)';
            }, 1200);
          }
        }

        function start() {
          timer = setInterval(function() {
            if (!isAutoPlay) return;
            currentIndex++;
            updateSlide();
          }, 5000);
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
          var likeCountKey = "like-count-" + postId;
          var currentCount = getLikeCount(postId);

          if (localStorage.getItem(likedKey)) {
            localStorage.removeItem(likedKey);
            setLikeCount(postId, Math.max(0, currentCount - 1));
            button.classList.remove("liked");
            button.textContent = "👍 Like (" + getLikeCount(postId) + ")";
          } else {
            localStorage.setItem(likedKey, "true");
            setLikeCount(postId, currentCount + 1);
            button.classList.add("liked");
            button.textContent = "👍 Liked (" + getLikeCount(postId) + ")";
          }
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
            commentEl.innerHTML = '<div class="comment-avatar">👤</div><div class="comment-body"><div class="comment-user">userunknown</div><div class="comment-text">' + escapeHtml(comment) + '</div></div>';
            list.appendChild(commentEl);
            input.value = "";

            var container = button.closest('.blog-item');
            if (container) {
              var postId = container.id;
              var newCommentCount = getCommentCount(postId) + 1;
              setCommentCount(postId, newCommentCount);
              var commentButton = document.querySelector('.social-comment[data-post="' + postId + '"]');
              if (commentButton) {
                commentButton.textContent = '💬 Comment (' + newCommentCount + ')';
              }
            }
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
