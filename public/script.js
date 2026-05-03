(function () {
  /* ── Dark mode toggle ── */
  const DARK_KEY = "ud-dark-mode";
  const htmlEl = document.documentElement;
  const toggleInput = document.getElementById("dark-mode-toggle");

  function applyTheme(dark) {
    if (dark) {
      htmlEl.setAttribute("data-theme", "dark");
    } else {
      htmlEl.removeAttribute("data-theme");
    }
    if (toggleInput) toggleInput.checked = dark;
  }

  // Apply saved preference immediately (before paint)
  applyTheme(localStorage.getItem(DARK_KEY) === "1");

  if (toggleInput) {
    toggleInput.addEventListener("change", function () {
      const isDark = toggleInput.checked;
      applyTheme(isDark);
      localStorage.setItem(DARK_KEY, isDark ? "1" : "0");
    });
  }

  /* ── Page-out transition on cross-page navigation ── */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("http") ||
      href.startsWith("mailto") ||
      href.startsWith("tel") ||
      a.target === "_blank" ||
      e.ctrlKey || e.metaKey || e.shiftKey
    ) return;
    e.preventDefault();
    document.body.classList.add("page-leaving");
    var dest = href;
    setTimeout(function () { window.location.href = dest; }, 180);
  });

  const header = document.querySelector(".site-header");
  const nav = document.querySelector("#site-nav");
  const navLinks = nav ? nav.querySelectorAll("a[href^='#']") : [];
  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* Scroll reveal */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* Scroll entrance animations (.scroll-animate)
     Also exposed as window.observeScrollAnimate so dynamic renderers
     can register freshly injected cards after the initial page scan. */
  var scrollObserver = null;
  if ('IntersectionObserver' in window) {
    scrollObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          scrollObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
  }

  function observeScrollAnimate(root) {
    var els = (root || document).querySelectorAll('.scroll-animate:not(.visible)');
    if (scrollObserver) {
      els.forEach(function(el) { scrollObserver.observe(el); });
    } else {
      els.forEach(function(el) { el.style.opacity = '1'; });
    }
  }

  observeScrollAnimate();
  window.observeScrollAnimate = observeScrollAnimate;

  /* Active nav hint on scroll */
  const sections = document.querySelectorAll("section[id]");
  if (sections.length && header && navLinks.length) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("id");
          navLinks.forEach(function (a) {
            const href = a.getAttribute("href");
            if (href === "#" + id) {
              a.setAttribute("aria-current", "page");
            } else {
              a.removeAttribute("aria-current");
            }
          });
        });
      },
      { rootMargin: "-" + (header.offsetHeight + 8) + "px 0px -55% 0px", threshold: 0 }
    );
    sections.forEach(function (s) {
      observer.observe(s);
    });
  }
})();
