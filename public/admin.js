(function () {
  var cred = { credentials: "same-origin", headers: { "Content-Type": "application/json" } };

  var loginPanel = document.getElementById("login-panel");
  var dashboard = document.getElementById("dashboard");
  var loginForm = document.getElementById("login-form");
  var loginMsg = document.getElementById("login-msg");
  var dashMsg = document.getElementById("dash-msg");
  var btnLogout = document.getElementById("btn-logout");

  var blogForm = document.getElementById("blog-form");
  var blogEditId = document.getElementById("blog-edit-id");
  var blogTitle = document.getElementById("blog-title");
  var blogDate = document.getElementById("blog-date");
  var blogExcerpt = document.getElementById("blog-excerpt");
  var blogLink = document.getElementById("blog-link");
  var blogImage = document.getElementById("blog-image");
  var blogSave = document.getElementById("blog-save");
  var blogCancelEdit = document.getElementById("blog-cancel-edit");
  var blogTableBody = document.getElementById("blog-table-body");

  var projectForm = document.getElementById("project-form");
  var projectEditId = document.getElementById("project-edit-id");
  var projectYear = document.getElementById("project-year");
  var projectTitle = document.getElementById("project-title");
  var projectDesc = document.getElementById("project-desc");
  var projectTags = document.getElementById("project-tags");
  var projectUrl = document.getElementById("project-url");
  var projectSave = document.getElementById("project-save");
  var projectCancelEdit = document.getElementById("project-cancel-edit");
  var projectsTableBody = document.getElementById("projects-table-body");

  function show(el, cls, text) {
    if (!el) return;
    if (text != null) el.textContent = text;
    el.classList.remove("admin-hidden");
    el.classList.remove("admin-msg-error", "admin-msg-success");
    if (cls) el.classList.add(cls);
  }

  function hide(el) {
    if (el) el.classList.add("admin-hidden");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showDashboard() {
    loginPanel.classList.add("admin-hidden");
    dashboard.classList.remove("admin-hidden");
    btnLogout.classList.remove("admin-hidden");
  }

  function showLogin() {
    dashboard.classList.add("admin-hidden");
    loginPanel.classList.remove("admin-hidden");
    btnLogout.classList.add("admin-hidden");
  }

  function loadContent() {
    return fetch("/api/admin/content", { credentials: "same-origin" }).then(function (r) {
      if (r.status === 401) throw new Error("auth");
      if (!r.ok) throw new Error("load");
      return r.json();
    });
  }

  function renderBlogRows(posts) {
    if (!blogTableBody) return;
    blogTableBody.innerHTML = (posts || [])
      .map(function (p) {
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(p.date || "") +
          "</td>" +
          "<td>" +
          escapeHtml(p.title || "") +
          "</td>" +
          "<td>" +
          (p.image && String(p.image).trim() ? "Yes" : "—") +
          "</td>" +
          '<td class="admin-table-actions">' +
          '<div class="dropdown">' +
          '<button type="button" class="dropdown-toggle">⋯</button>' +
          '<div class="dropdown-menu">' +
          '<button type="button" data-blog-edit="' +
          escapeHtml(p.id) +
          '">Edit</button>' +
          '<button type="button" class="danger" data-blog-del="' +
          escapeHtml(p.id) +
          '">Delete</button>' +
          '</div>' +
          '</div>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderProjectRows(items) {
    if (!projectsTableBody) return;
    projectsTableBody.innerHTML = (items || [])
      .map(function (p) {
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(p.year || "") +
          "</td>" +
          "<td>" +
          escapeHtml(p.title || "") +
          "</td>" +
          '<td class="admin-table-actions">' +
          '<div class="dropdown">' +
          '<button type="button" class="dropdown-toggle">⋯</button>' +
          '<div class="dropdown-menu">' +
          '<button type="button" data-project-edit="' +
          escapeHtml(p.id) +
          '">Edit</button>' +
          '<button type="button" class="danger" data-project-del="' +
          escapeHtml(p.id) +
          '">Delete</button>' +
          '</div>' +
          '</div>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function refreshTables() {
    return loadContent()
      .then(function (data) {
        renderBlogRows(data.blog);
        renderProjectRows(data.projects);
        hide(dashMsg);
      })
      .catch(function (e) {
        if (e.message === "auth") {
          showLogin();
        } else {
          show(dashMsg, "admin-msg-error", "Could not load content.");
        }
      });
  }

  function resetBlogForm() {
    blogForm.reset();
    blogEditId.value = "";
    blogSave.textContent = "Save post";
    blogCancelEdit.classList.add("admin-hidden");
  }

  function resetProjectForm() {
    projectForm.reset();
    projectEditId.value = "";
    projectSave.textContent = "Save project";
    projectCancelEdit.classList.add("admin-hidden");
  }

  blogTableBody.addEventListener("click", function (e) {
    var t = e.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.matches(".dropdown-toggle")) {
      var dropdown = t.closest(".dropdown");
      dropdown.classList.toggle("open");
      return;
    }

    var editId = t.getAttribute("data-blog-edit");
    var delId = t.getAttribute("data-blog-del");
    if (editId) {
      loadContent().then(function (data) {
        var post = (data.blog || []).find(function (p) {
          return p.id === editId;
        });
        if (!post) return;
        blogEditId.value = post.id;
        blogTitle.value = post.title || "";
        blogDate.value = post.date || "";
        blogExcerpt.value = post.excerpt || "";
        blogLink.value = post.link || "";
        if (blogImage) blogImage.value = post.image || "";
        blogSave.textContent = "Update post";
        blogCancelEdit.classList.remove("admin-hidden");
        blogTitle.focus();
      });
    }
    if (delId) {
      if (!confirm("Delete this blog post?")) return;
      fetch("/api/admin/blog/" + encodeURIComponent(delId), { method: "DELETE", credentials: "same-origin" }).then(
        function (r) {
          if (r.status === 401) {
            showLogin();
            return;
          }
          if (!r.ok) throw new Error();
          show(dashMsg, "admin-msg-success", "Post deleted.");
          resetBlogForm();
          return refreshTables();
        }
      ).catch(function () {
        show(dashMsg, "admin-msg-error", "Delete failed.");
      });
    }
  });

  projectsTableBody.addEventListener("click", function (e) {
    var t = e.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.matches(".dropdown-toggle")) {
      var dropdown = t.closest(".dropdown");
      dropdown.classList.toggle("open");
      return;
    }

    var editId = t.getAttribute("data-project-edit");
    var delId = t.getAttribute("data-project-del");
    if (editId) {
      loadContent().then(function (data) {
        var item = (data.projects || []).find(function (p) {
          return p.id === editId;
        });
        if (!item) return;
        projectEditId.value = item.id;
        projectYear.value = item.year || "";
        projectTitle.value = item.title || "";
        projectDesc.value = item.description || "";
        projectTags.value = item.tags || "";
        projectUrl.value = item.url || "";
        projectSave.textContent = "Update project";
        projectCancelEdit.classList.remove("admin-hidden");
        projectTitle.focus();
      });
    }
    if (delId) {
      if (!confirm("Delete this project?")) return;
      fetch("/api/admin/projects/" + encodeURIComponent(delId), {
        method: "DELETE",
        credentials: "same-origin",
      })
        .then(function (r) {
          if (r.status === 401) {
            showLogin();
            return;
          }
          if (!r.ok) throw new Error();
          show(dashMsg, "admin-msg-success", "Project deleted.");
          resetProjectForm();
          return refreshTables();
        })
        .catch(function () {
          show(dashMsg, "admin-msg-error", "Delete failed.");
        });
    }
  });

  blogForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = blogEditId.value.trim();
    var body = JSON.stringify({
      title: blogTitle.value,
      date: blogDate.value,
      excerpt: blogExcerpt.value,
      link: blogLink.value.trim(),
      image: blogImage ? blogImage.value.trim() : "",
    });
    var url = id ? "/api/admin/blog/" + encodeURIComponent(id) : "/api/admin/blog";
    var method = id ? "PUT" : "POST";
    fetch(url, Object.assign({}, cred, { method: method, body: body }))
      .then(function (r) {
        if (r.status === 401) {
          showLogin();
          return;
        }
        if (!r.ok) return r.json().then(function (j) {
          throw new Error((j && j.error) || "save");
        });
        return r.json();
      })
      .then(function () {
        show(dashMsg, "admin-msg-success", id ? "Post updated." : "Post created.");
        resetBlogForm();
        return refreshTables();
      })
      .catch(function () {
        show(dashMsg, "admin-msg-error", "Could not save post. Check fields (date must be YYYY-MM-DD).");
      });
  });

  blogCancelEdit.addEventListener("click", function () {
    resetBlogForm();
  });

  projectForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = projectEditId.value.trim();
    var body = JSON.stringify({
      year: projectYear.value,
      title: projectTitle.value,
      description: projectDesc.value,
      tags: projectTags.value,
      url: projectUrl.value.trim(),
    });
    var url = id ? "/api/admin/projects/" + encodeURIComponent(id) : "/api/admin/projects";
    var method = id ? "PUT" : "POST";
    fetch(url, Object.assign({}, cred, { method: method, body: body }))
      .then(function (r) {
        if (r.status === 401) {
          showLogin();
          return;
        }
        if (!r.ok) return r.json().then(function (j) {
          throw new Error((j && j.error) || "save");
        });
        return r.json();
      })
      .then(function () {
        show(dashMsg, "admin-msg-success", id ? "Project updated." : "Project created.");
        resetProjectForm();
        return refreshTables();
      })
      .catch(function () {
        show(dashMsg, "admin-msg-error", "Could not save project.");
      });
  });

  projectCancelEdit.addEventListener("click", function () {
    resetProjectForm();
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hide(loginMsg);
    var password = document.getElementById("password").value;
    fetch("/api/auth/login", Object.assign({}, cred, { method: "POST", body: JSON.stringify({ password: password }) }))
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (!x.ok) {
          show(loginMsg, "admin-msg-error", x.j.error || "Sign in failed.");
          return;
        }
        document.getElementById("password").value = "";
        showDashboard();
        return refreshTables();
      })
      .catch(function () {
        show(loginMsg, "admin-msg-error", "Network error.");
      });
  });

  btnLogout.addEventListener("click", function () {
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(function () {
      resetBlogForm();
      resetProjectForm();
      showLogin();
    });
  });

  fetch("/api/auth/status", { credentials: "same-origin" })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (data.authenticated) {
        showDashboard();
        return refreshTables();
      }
      showLogin();
    })
    .catch(function () {
      showLogin();
    });
})();
