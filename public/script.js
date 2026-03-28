(function () {
  const header = document.querySelector(".site-header");
  const nav = document.querySelector("#site-nav");
  const toggle = document.querySelector(".nav-toggle");
  const navLinks = nav ? nav.querySelectorAll("a[href^='#']") : [];
  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.style.overflow = "";
  }

  function openNav() {
    if (!nav || !toggle) return;
    nav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    document.body.style.overflow = "hidden";
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      if (nav.classList.contains("is-open")) {
        closeNav();
      } else {
        openNav();
      }
    });

    const backdrop = nav.querySelector(".nav-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        closeNav();
      });
    }
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      if (window.matchMedia("(max-width: 768px)").matches) {
        closeNav();
      }
    });
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) closeNav();
  });

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
