(function () {
  "use strict";

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('Admin.js initializing...');

    var cred = { credentials: "same-origin", headers: { "Content-Type": "application/json" } };

    var loginPanel = document.getElementById("login-panel");
    var dashboard = document.getElementById("dashboard");
    var loginForm = document.getElementById("login-form");
    var loginMsg = document.getElementById("login-msg");
    var dashMsg = document.getElementById("dash-msg");
    var btnLogout = document.getElementById("btn-logout");
    var adminSidebar = document.getElementById("admin-sidebar");

    var blogGrid = document.getElementById("blog-grid");
    var projectGrid = document.getElementById("project-grid");
    var btnAddBlog = document.getElementById("btn-add-blog");
    var btnAddProject = document.getElementById("btn-add-project");

    var editModal = document.getElementById("edit-modal");
    var modalTitle = document.getElementById("modal-title");
    var editForm = document.getElementById("edit-form");
    var editType = document.getElementById("edit-type");
    var editId = document.getElementById("edit-id");
    var blogFields = document.getElementById("blog-fields");
    var projectFields = document.getElementById("project-fields");
    var btnSave = document.getElementById("btn-save");
    var btnDelete = document.getElementById("btn-delete");
    var modalCloseButtons = document.querySelectorAll(".modal-close");

    console.log('DOM elements found:', {
      loginPanel: !!loginPanel,
      dashboard: !!dashboard,
      blogGrid: !!blogGrid,
      projectGrid: !!projectGrid
    });

    // Navigation handling
    var navItems = document.querySelectorAll('.admin-nav-item');
    navItems.forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        var section = this.getAttribute('data-section');

        // Remove active class from all nav items
        navItems.forEach(function(nav) {
          nav.classList.remove('active');
        });
        // Add active class to clicked item
        this.classList.add('active');

        // Hide all sections
        var sections = document.querySelectorAll('.admin-main > div[id]');
        sections.forEach(function(sec) {
          sec.classList.add('admin-hidden');
          var container = sec.querySelector('.container.reveal');
          if (container) {
            container.classList.remove('is-visible');
          }
        });

        // Show selected section
        if (section === 'dashboard') {
          dashboard.classList.remove('admin-hidden');
          var dashboardContainer = dashboard.querySelector('.container.reveal');
          if (dashboardContainer) {
            dashboardContainer.classList.add('is-visible');
          }
          // Load content if not already loaded
          if (!blogGrid.children.length && !projectGrid.children.length) {
            refreshCards();
          }
        }
      });
    });

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
      console.log('showDashboard called');
      loginPanel.classList.add("admin-hidden");
      dashboard.classList.remove("admin-hidden");
      adminSidebar.classList.remove("admin-hidden");
      btnLogout.classList.remove("admin-hidden");

      // Add is-visible class to the dashboard container for reveal animation
      var dashboardContainer = dashboard.querySelector('.container.reveal');
      if (dashboardContainer) {
        dashboardContainer.classList.add('is-visible');
      }

      console.log('Dashboard visibility:', {
        loginPanelHidden: loginPanel.classList.contains('admin-hidden'),
        dashboardVisible: !dashboard.classList.contains('admin-hidden'),
        sidebarVisible: !adminSidebar.classList.contains('admin-hidden'),
        dashboardContainerVisible: dashboardContainer ? dashboardContainer.classList.contains('is-visible') : false
      });
    }

    function showLogin() {
      dashboard.classList.add("admin-hidden");
      loginPanel.classList.remove("admin-hidden");
      adminSidebar.classList.add("admin-hidden");
      btnLogout.classList.add("admin-hidden");

      // Remove is-visible class from the dashboard container
      var dashboardContainer = dashboard.querySelector('.container.reveal');
      if (dashboardContainer) {
        dashboardContainer.classList.remove('is-visible');
      }
    }

    function loadContent() {
      return fetch("/api/admin/content", { credentials: "same-origin" }).then(function (r) {
        if (r.status === 401) throw new Error("auth");
        if (!r.ok) throw new Error("load");
        return r.json();
      });
    }

    function renderBlogCards(posts) {
      if (!blogGrid) {
        console.error('blogGrid element not found!');
        return;
      }
      console.log('Rendering blog cards:', posts);
      blogGrid.innerHTML = (posts || [])
        .map(function (p) {
          return (
            '<li class="admin-card" data-id="' + escapeHtml(p.id) + '">' +
            '<button type="button" class="admin-card-edit-btn" data-blog-edit="' + escapeHtml(p.id) + '" title="Edit blog post">⋯</button>' +
            '<h3 class="admin-card-title">' + escapeHtml(p.title || "") + '</h3>' +
            '<p class="admin-card-date">' + escapeHtml(p.date || "") + '</p>' +
            '<p class="admin-card-desc">' + escapeHtml(p.excerpt || "").substring(0, 100) + '...</p>' +
            '<div class="admin-card-meta">' +
            (p.image && String(p.image).trim() ? "📷 Has image" : "") +
            '</div>' +
            '</li>'
          );
        })
        .join("");
      console.log('Blog grid HTML set, length:', blogGrid.innerHTML.length);
      // Reattach listeners after rendering
      attachCardListeners();
    }

    function renderProjectCards(projects) {
      if (!projectGrid) {
        console.error('projectGrid element not found!');
        return;
      }
      console.log('Rendering project cards:', projects);
      projectGrid.innerHTML = (projects || [])
        .map(function (p) {
          return (
            '<li class="admin-card" data-id="' + escapeHtml(p.id) + '">' +
            '<button type="button" class="admin-card-edit-btn" data-project-edit="' + escapeHtml(p.id) + '" title="Edit project">⋯</button>' +
            '<h3 class="admin-card-title">' + escapeHtml(p.title || "") + '</h3>' +
            '<p class="admin-card-date">' + escapeHtml(p.year || "") + '</p>' +
            '<p class="admin-card-desc">' + escapeHtml(p.description || "").substring(0, 100) + '...</p>' +
            '<div class="admin-card-meta">' + escapeHtml(p.tags || "") + '</div>' +
            '</li>'
          );
        })
        .join("");
      console.log('Project grid HTML set, length:', projectGrid.innerHTML.length);
      // Reattach listeners after rendering
      attachCardListeners();
    }

    function refreshCards() {
      console.log('refreshCards called');
      return loadContent()
        .then(function (data) {
          console.log('Content loaded:', data);
          renderBlogCards(data.blog);
          renderProjectCards(data.projects);
          hide(dashMsg);
        })
        .catch(function (e) {
          console.error('Error loading content:', e);
          if (e.message === "auth") {
            showLogin();
          } else {
            show(dashMsg, "admin-msg-error", "Could not load content.");
          }
        });
    }

    function openModal(type, id) {
      editType.value = type;
      editId.value = id || "";

      if (type === "blog") {
        show(blogFields);
        hide(projectFields);
        if (id) {
          modalTitle.textContent = "Edit Blog Post";
          loadContent().then(function (data) {
            var post = (data.blog || []).find(function (p) { return p.id === id; });
            if (!post) return;
            document.getElementById("edit-title").value = post.title || "";
            document.getElementById("edit-date").value = post.date || "";
            document.getElementById("edit-excerpt").value = post.excerpt || "";
            document.getElementById("edit-link").value = post.link || "";
            document.getElementById("edit-image").value = post.image || "";
            show(btnDelete);
          });
        } else {
          modalTitle.textContent = "Add New Blog Post";
          editForm.reset();
          hide(btnDelete);
        }
      } else {
        hide(blogFields);
        show(projectFields);
        if (id) {
          modalTitle.textContent = "Edit Project";
          loadContent().then(function (data) {
            var proj = (data.projects || []).find(function (p) { return p.id === id; });
            if (!proj) return;
            document.getElementById("edit-year").value = proj.year || "";
            document.getElementById("edit-project-title").value = proj.title || "";
            document.getElementById("edit-desc").value = proj.description || "";
            document.getElementById("edit-tags").value = proj.tags || "";
            document.getElementById("edit-project-url").value = proj.url || "";
            show(btnDelete);
          });
        } else {
          modalTitle.textContent = "Add New Project";
          editForm.reset();
          hide(btnDelete);
        }
      }

      editModal.classList.remove("admin-hidden");
    }

    function closeModal() {
      editModal.classList.add("admin-hidden");
    }

    function attachCardListeners() {
      var editButtons = document.querySelectorAll("[data-blog-edit], [data-project-edit]");
      editButtons.forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var blogEditId = btn.getAttribute("data-blog-edit");
          var projEditId = btn.getAttribute("data-project-edit");
          openModal(blogEditId ? "blog" : "project", blogEditId || projEditId);
        });
      });
    }

    // Event listeners
    btnAddBlog.addEventListener("click", function () {
      openModal("blog", null);
    });

    btnAddProject.addEventListener("click", function () {
      openModal("project", null);
    });

    modalCloseButtons.forEach(function (btn) {
      btn.addEventListener("click", closeModal);
    });

    editModal.addEventListener("click", function (e) {
      if (e.target === editModal || e.target.classList.contains("modal-overlay")) {
        closeModal();
      }
    });

    btnSave.addEventListener("click", function () {
      var type = editType.value;
      var id = editId.value.trim();

      if (type === "blog") {
        var body = JSON.stringify({
          title: document.getElementById("edit-title").value,
          date: document.getElementById("edit-date").value,
          excerpt: document.getElementById("edit-excerpt").value,
          link: document.getElementById("edit-link").value.trim(),
          image: document.getElementById("edit-image").value.trim(),
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
            show(dashMsg, "admin-msg-success", id ? "Blog updated." : "Blog created.");
            closeModal();
            return refreshCards();
          })
          .catch(function () {
            show(dashMsg, "admin-msg-error", "Could not save blog.");
          });
      } else {
        var body = JSON.stringify({
          year: document.getElementById("edit-year").value,
          title: document.getElementById("edit-project-title").value,
          description: document.getElementById("edit-desc").value,
          tags: document.getElementById("edit-tags").value,
          url: document.getElementById("edit-project-url").value.trim(),
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
            closeModal();
            return refreshCards();
          })
          .catch(function () {
            show(dashMsg, "admin-msg-error", "Could not save project.");
          });
      }
    });

    btnDelete.addEventListener("click", function () {
      var type = editType.value;
      var id = editId.value.trim();
      if (!id) return;

      if (!confirm("Are you sure you want to delete this?")) return;

      var url = type === "blog" ? "/api/admin/blog/" + encodeURIComponent(id) : "/api/admin/projects/" + encodeURIComponent(id);

      fetch(url, { method: "DELETE", credentials: "same-origin" })
        .then(function (r) {
          if (r.status === 401) {
            showLogin();
            return;
          }
          if (!r.ok) throw new Error();
          show(dashMsg, "admin-msg-success", "Item deleted.");
          closeModal();
          return refreshCards();
        })
        .catch(function () {
          show(dashMsg, "admin-msg-error", "Delete failed.");
        });
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
          console.log('Login successful, calling refreshCards');
          return refreshCards();
        })
        .catch(function () {
          show(loginMsg, "admin-msg-error", "Network error.");
        });
    });

    btnLogout.addEventListener("click", function () {
      fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(function () {
        showLogin();
      });
    });

    fetch("/api/auth/status", { credentials: "same-origin" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.authenticated) {
          console.log('User is authenticated, showing dashboard and refreshing cards');
          showDashboard();
          return refreshCards();
        }
        console.log('User not authenticated, showing login');
        showLogin();
      })
      .catch(function () {
        showLogin();
      });
  }
})();

