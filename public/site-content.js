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

  var likesByPost = {};
  var commentCountsByPost = {};
  var toastTimer = null;

  function getLikeCount(postId) {
    return Number(likesByPost[postId] || 0);
  }

  function setLikeCount(postId, count) {
    likesByPost[postId] = Math.max(0, Math.floor(count));
  }

  function getCommentCount(postId) {
    return Number(commentCountsByPost[postId] || 0);
  }

  function setCommentCount(postId, count) {
    commentCountsByPost[postId] = Math.max(0, Math.floor(count));
  }

  var projectList = document.getElementById("project-list");
  var blogList = document.getElementById("blog-list");
  var projectsStatus = document.getElementById("projects-status");
  var blogStatus = document.getElementById("blog-status");

  if (!projectList && !blogList) return;

  function showStatus(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("admin-hidden");
    el.style.color = isError ? "#6b2d2d" : "";
  }

  function showToast(message) {
    var toast = document.getElementById("site-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "site-toast";
      toast.className = "site-toast";
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);
  }

  function renderCommentsList(postId, comments) {
    var list = document.querySelector('#comments-' + postId + ' .comments-list');
    if (!list) return;
    if (!Array.isArray(comments) || comments.length === 0) {
      list.innerHTML = '<p class="comment-empty">No comments yet. Be the first to share a thought.</p>';
      return;
    }
    list.innerHTML = comments
      .map(function (comment) {
        return (
          '<div class="comment">' +
          '<div class="comment-avatar">👤</div>' +
          '<div class="comment-body">' +
          '<div class="comment-user">Anonymous</div>' +
          '<div class="comment-text">' +
          escapeHtml(comment.text || "") +
          '</div>' +
          '</div>' +
          '</div>'
        );
      })
      .join("");
  }

  function bindProjectCardClicks() {
    if (!projectList) return;
    projectList.querySelectorAll(".project-card").forEach(function (card) {
      card.style.cursor = "pointer";
      card.addEventListener("click", function (e) {
        // Let anchor tags (e.g. GitHub button) handle their own navigation
        if (e.target.closest('a,button')) return;
        if (this.dataset && this.dataset.href) {
          window.location.href = this.dataset.href;
        }
      });
    });
  }

  function initProjectCarousel() {
    var carousel = document.querySelector(".project-carousel");
    if (!carousel) return;
    var carouselList = carousel.querySelector(".project-list");
    if (!carouselList) return;
    var cards = carouselList.querySelectorAll(".project-card");
    if (cards.length < 2) return;

    var cardWidth = cards[0].offsetWidth + 15;
    var totalCards = cards.length;
    var currentIndex = 0;
    var isAutoPlay = true;
    var timer = null;

    cards.forEach(function (card) {
      var clone = card.cloneNode(true);
      carouselList.appendChild(clone);
    });
    cards.forEach(function (card) {
      var clone = card.cloneNode(true);
      carouselList.appendChild(clone);
    });

    function updateSlide() {
      var scrollAmount = currentIndex * cardWidth;
      carouselList.style.transition = "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)";
      carouselList.style.transform = "translateX(-" + scrollAmount + "px)";
      if (currentIndex === totalCards) {
        setTimeout(function () {
          carouselList.style.transition = "none";
          currentIndex = 0;
          carouselList.style.transform = "translateX(0)";
        }, 1200);
      }
    }

    function start() {
      timer = setInterval(function () {
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

  function loadSocialCounts() {
    return fetch("/api/public/social", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("social");
        return r.json();
      })
      .catch(function () {
        return { posts: {} };
      })
      .then(function (social) {
        Object.entries(social.posts || {}).forEach(function (_a) {
          var postId = _a[0];
          var info = _a[1];
          setLikeCount(postId, Number(info.likes || 0));
          setCommentCount(postId, Number(info.commentCount || 0));
        });
      });
  }

  function renderProjects(projects) {
    if (!projectList) return;
    projectList.innerHTML = projects
      .map(function (p, index) {
        var titleHtml = escapeHtml(p.title || "");
        var detailHref = "/project.html?id=" + encodeURIComponent(p.id || "");

        var imgBlock = (p.image && String(p.image).trim())
          ? '<img class="project-card-img" src="' + escapeHtml(String(p.image).trim()) + '" alt="' + escapeHtml(p.title || "") + '">'
          : '<div class="project-card-img-placeholder" aria-hidden="true">📊</div>';

        var tagPills = '';
        if (p.tags) {
          var tagArr = String(p.tags).split(/[·,]/).map(function(t) { return t.trim(); }).filter(Boolean);
          tagPills = '<div class="tech-tags">' + tagArr.map(function(t) {
            return '<span class="tech-tag">' + escapeHtml(t) + '</span>';
          }).join('') + '</div>';
        }

        var linkBtn = (p.url && String(p.url).trim())
          ? '<a class="github-btn" href="' + escapeHtml(String(p.url).trim()) + '" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github" aria-hidden="true"></i> View on GitHub</a>'
          : '';

        return (
          '<li class="project-card" data-index="' + index + '" data-href="' + detailHref + '">' +
          imgBlock +
          '<div class="project-card-content">' +
          '<div class="card-top">' +
          '<h3 class="project-title">' + titleHtml + "</h3>" +
          '<div class="card-menu-wrap">' +
          '<button type="button" class="card-more" aria-label="Project actions" aria-haspopup="true" aria-expanded="false">⋯</button>' +
          '<div class="card-menu" role="menu" hidden>' +
          '<button type="button" class="card-menu-item card-copy-link" role="menuitem" data-url="' + escapeHtml(detailHref) + '">Copy link</button>' +
          '<button type="button" class="card-menu-item card-copy-title-link" role="menuitem" data-url="' + escapeHtml(detailHref) + '" data-title="' + titleHtml + '">Copy title + link</button>' +
          '<button type="button" class="card-menu-item card-open-link" role="menuitem" data-url="' + escapeHtml(detailHref) + '">Open in new tab</button>' +
          '<button type="button" class="card-menu-item card-share-linkedin" role="menuitem" data-url="' + escapeHtml(detailHref) + '">Share to LinkedIn</button>' +
          '</div>' +
          '</div>' +
          '</div>' +
          '<span class="project-year">' + escapeHtml(p.year || "") + '</span>' +
          '<p class="project-desc">' + escapeHtml(p.description || "") + "</p>" +
          tagPills +
          linkBtn +
          '</div>' +
          "</li>"
        );
      })
      .join("");

    if (projects.length === 0) {
      showStatus(projectsStatus, "No projects yet — check back soon.", false);
    }
    bindProjectCardClicks();
    initProjectCarousel();
    if (window.observeScrollAnimate) window.observeScrollAnimate(projectList);
  }

  function renderBlogPosts(blog) {
    if (!blogList) return;
    blogList.innerHTML = blog
      .map(function (post) {
        var detailPath = post.path && String(post.path).trim() ? String(post.path).trim() : "";
        var sourceLink = post.link && String(post.link).trim();
        var title = escapeHtml(post.title || "");
        var rawImg = post.image && String(post.image).trim() ? String(post.image).trim() : "";
        var imgSrc = rawImg ? escapeHtml(rawImg) : "";
        var imgAlt = escapeHtml(post.title || "Blog image");
        var imgBlock = imgSrc
          ? '<figure class="blog-figure"><img class="blog-image" src="' + imgSrc + '" alt="' + imgAlt + '" decoding="async"></figure>'
          : "";
        var postId = post.id || "blog-" + Math.random().toString(36).slice(2, 10);
        var likeCount = getLikeCount(postId);
        var commentCount = getCommentCount(postId);
        var userLiked = Boolean(localStorage.getItem("liked-" + postId));
        var blogCopyPath = detailPath || ("/blogs.html#" + postId);
        return (
          '<li class="blog-item" id="' + postId + '">' +
          '<div class="card-top">' +
          '<h3 class="blog-title">' +
          (detailPath ? '<a href="' + escapeHtml(detailPath) + '">' + title + '</a>' : title) +
          "</h3>" +
          '<div class="card-menu-wrap">' +
          '<button type="button" class="card-more" aria-label="Blog actions" aria-haspopup="true" aria-expanded="false">⋯</button>' +
          '<div class="card-menu" role="menu" hidden>' +
          '<button type="button" class="card-menu-item card-copy-link" role="menuitem" data-url="' + escapeHtml(blogCopyPath) + '">Copy link</button>' +
          '<button type="button" class="card-menu-item card-copy-title-link" role="menuitem" data-url="' + escapeHtml(blogCopyPath) + '" data-title="' + title + '">Copy title + link</button>' +
          '<button type="button" class="card-menu-item card-open-link" role="menuitem" data-url="' + escapeHtml(blogCopyPath) + '">Open in new tab</button>' +
          '<button type="button" class="card-menu-item card-share-linkedin" role="menuitem" data-url="' + escapeHtml(blogCopyPath) + '">Share to LinkedIn</button>' +
          '</div>' +
          '</div>' +
          '</div>' +
          '<p class="blog-date" datetime="' + escapeHtml(post.date || "") + '">' + formatBlogDate(post.date) + "</p>" +
          '<div class="blog-excerpt">' + (post.excerpt || "") + "</div>" +
          (detailPath ? '<a class="blog-read-more" href="' + escapeHtml(detailPath) + '">Read more</a>' : "") +
          (sourceLink ? '<a class="blog-read-more" href="' + escapeHtml(sourceLink) + '" target="_blank" rel="noopener noreferrer">Source</a>' : "") +
          imgBlock +
          '<div class="social-bar">' +
          '<button type="button" class="social-like ' + (userLiked ? 'liked' : '') + '" data-post="' + postId + '">👍 ' + (userLiked ? 'Liked' : 'Like') + ' (' + likeCount + ')</button>' +
          '<button type="button" class="social-comment" data-post="' + postId + '">💬 Comment (' + commentCount + ')</button>' +
          '<button type="button" class="social-share" data-post="' + postId + '" data-url="' + escapeHtml(detailPath || "") + '">📤 Share</button>' +
          '</div>' +
          '<div class="comment-section" id="comments-' + postId + '" style="display:none;" data-loaded="false">' +
          '<textarea class="comment-input" placeholder="Write a comment..."></textarea>' +
          '<button type="button" class="comment-submit">Post Comment</button>' +
          '<div class="comments-list"></div>' +
          '</div>' +
          "</li>"
        );
      })
      .join("");

    if (blog.length === 0) {
      showStatus(blogStatus, "No blog posts yet.", false);
    }
  }

  function handleLikeButton(button) {
    var postId = button.getAttribute("data-post");
    var likedKey = "liked-" + postId;
    var currentlyLiked = Boolean(localStorage.getItem(likedKey));
    var action = currentlyLiked ? "unlike" : "like";

    fetch("/api/public/social/" + encodeURIComponent(postId) + "/like", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("like");
        return r.json();
      })
      .then(function (data) {
        if (currentlyLiked) {
          localStorage.removeItem(likedKey);
        } else {
          localStorage.setItem(likedKey, "true");
        }
        setLikeCount(postId, data.likes || 0);
        button.classList.toggle("liked", !currentlyLiked);
        button.textContent =
          "👍 " + (!currentlyLiked ? "Liked" : "Like") + " (" + getLikeCount(postId) + ")";
      })
      .catch(function () {
        alert("Could not update the like count right now.");
      });
  }

  function handleCommentButton(button) {
    var postId = button.getAttribute("data-post");
    var commentSection = document.getElementById("comments-" + postId);
    if (!commentSection) return;

    var isOpen = commentSection.style.display !== "block";
    commentSection.style.display = isOpen ? "block" : "none";
    if (!isOpen || commentSection.dataset.loaded === "true") {
      return;
    }

    fetch("/api/public/social/" + encodeURIComponent(postId), {
      credentials: "same-origin",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("social");
        return r.json();
      })
      .then(function (data) {
        renderCommentsList(postId, data.comments || []);
        setCommentCount(postId, data.comments ? data.comments.length : 0);
        var commentButton = document.querySelector('.social-comment[data-post="' + postId + '"]');
        if (commentButton) {
          commentButton.textContent = '💬 Comment (' + getCommentCount(postId) + ')';
        }
        commentSection.dataset.loaded = "true";
      })
      .catch(function () {
        renderCommentsList(postId, []);
      });
  }

  function toAbsoluteUrl(pathLike) {
    try {
      return new URL(pathLike, window.location.origin).href;
    } catch {
      return window.location.href;
    }
  }

  function closeCardMenus(exceptWrap) {
    document.querySelectorAll(".card-menu-wrap.is-open").forEach(function (wrap) {
      if (exceptWrap && wrap === exceptWrap) return;
      wrap.classList.remove("is-open");
      var menu = wrap.querySelector(".card-menu");
      var trigger = wrap.querySelector(".card-more");
      if (menu) menu.hidden = true;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  function toggleCardMenu(button) {
    var wrap = button.closest(".card-menu-wrap");
    if (!wrap) return;
    var menu = wrap.querySelector(".card-menu");
    if (!menu) return;
    var willOpen = menu.hidden;
    closeCardMenus(wrap);
    menu.hidden = !willOpen;
    wrap.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }

  function handleShareButton(button) {
    var postId = button.getAttribute("data-post");
    var dataUrl = button.getAttribute("data-url") || "";
    var fallback = window.location.pathname + "#" + postId;
    var blogUrl = toAbsoluteUrl(dataUrl || fallback);
    navigator.clipboard
      .writeText(blogUrl)
      .then(function () {
        showToast("Blog link copied.");
      })
      .catch(function () {
        window.prompt("Copy this URL", blogUrl);
      });
  }

  function handleCopyLinkButton(button) {
    var dataUrl = button.getAttribute("data-url") || "";
    var targetUrl = toAbsoluteUrl(dataUrl || window.location.href);
    navigator.clipboard
      .writeText(targetUrl)
      .then(function () {
        showToast("Link copied.");
      })
      .catch(function () {
        window.prompt("Copy this URL", targetUrl);
      });
  }

  function handleCopyTitleLinkButton(button) {
    var dataUrl = button.getAttribute("data-url") || "";
    var title = (button.getAttribute("data-title") || "").trim();
    var targetUrl = toAbsoluteUrl(dataUrl || window.location.href);
    var text = title ? title + "\n" + targetUrl : targetUrl;
    navigator.clipboard
      .writeText(text)
      .then(function () {
        showToast("Title and link copied.");
      })
      .catch(function () {
        window.prompt("Copy this text", text);
      });
  }

  function handleOpenLinkButton(button) {
    var dataUrl = button.getAttribute("data-url") || "";
    var targetUrl = toAbsoluteUrl(dataUrl || window.location.href);
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  function handleLinkedInShareButton(button) {
    var dataUrl = button.getAttribute("data-url") || "";
    var targetUrl = toAbsoluteUrl(dataUrl || window.location.href);
    var shareUrl = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(targetUrl);
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  function handleCommentSubmit(button) {
    var commentSection = button.closest(".comment-section");
    if (!commentSection) return;
    var input = commentSection.querySelector(".comment-input");
    var list = commentSection.querySelector(".comments-list");
    var comment = input.value.trim();
    if (!comment) return;

    var postId = commentSection.id.replace(/^comments-/, "");

    fetch("/api/public/social/" + encodeURIComponent(postId) + "/comment", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("comment");
        return r.json();
      })
      .then(function (data) {
        input.value = "";
        var newComment = data.comment;
        if (newComment) {
          var commentEl = document.createElement("div");
          commentEl.className = "comment";
          commentEl.innerHTML =
            '<div class="comment-avatar">👤</div><div class="comment-body"><div class="comment-user">Anonymous</div><div class="comment-text">' +
            escapeHtml(newComment.text || "") +
            "</div></div>";
          list.appendChild(commentEl);
        }
        setCommentCount(postId, data.commentCount || getCommentCount(postId));
        var commentButton = document.querySelector('.social-comment[data-post="' + postId + '"]');
        if (commentButton) {
          commentButton.textContent = '💬 Comment (' + getCommentCount(postId) + ')';
        }
        commentSection.dataset.loaded = "true";
      })
      .catch(function () {
        showToast("Could not post comment right now.");
      });
  }

  function handleGlobalClick(event) {
    var el = event.target;
    if (!(el instanceof HTMLElement)) return;
    var wrap = el.closest(".card-menu-wrap");
    if (!wrap) {
      closeCardMenus();
    }
    var button = el.closest(".social-like, .social-comment, .social-share, .comment-submit, .card-more, .card-copy-link, .card-copy-title-link, .card-open-link, .card-share-linkedin");
    if (!button) return;
    if (button.matches(".card-more")) {
      event.preventDefault();
      event.stopPropagation();
      toggleCardMenu(button);
      return;
    }
    if (button.matches(".card-copy-link")) {
      event.preventDefault();
      event.stopPropagation();
      handleCopyLinkButton(button);
      closeCardMenus();
      return;
    }
    if (button.matches(".card-copy-title-link")) {
      event.preventDefault();
      event.stopPropagation();
      handleCopyTitleLinkButton(button);
      closeCardMenus();
      return;
    }
    if (button.matches(".card-open-link")) {
      event.preventDefault();
      event.stopPropagation();
      handleOpenLinkButton(button);
      closeCardMenus();
      return;
    }
    if (button.matches(".card-share-linkedin")) {
      event.preventDefault();
      event.stopPropagation();
      handleLinkedInShareButton(button);
      closeCardMenus();
      return;
    }
    if (button.matches(".social-like")) {
      handleLikeButton(button);
      return;
    }
    if (button.matches(".social-comment")) {
      handleCommentButton(button);
      return;
    }
    if (button.matches(".social-share")) {
      handleShareButton(button);
      return;
    }
    if (button.matches(".comment-submit")) {
      handleCommentSubmit(button);
      return;
    }
  }

  fetch("/api/public/content", { credentials: "same-origin" })
    .then(function (r) {
      if (!r.ok) throw new Error("load");
      return r.json();
    })
    .then(function (data) {
      return loadSocialCounts().then(function () {
        renderProjects(data.projects || []);
        renderBlogPosts(data.blog || []);
      });
    })
    .catch(function () {
      showStatus(projectsStatus, "Couldn’t load projects. Refresh or try again later.", true);
      showStatus(blogStatus, "Couldn’t load blog posts.", true);
    });

  document.addEventListener("click", handleGlobalClick);
})();
