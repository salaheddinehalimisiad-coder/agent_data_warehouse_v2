/*
 * Agent BI — Docs site helper
 * Handles: sidebar active link, TOC build from h2/h3, smooth scroll,
 * mobile menu toggle, and copy-to-clipboard buttons on <pre> blocks.
 */

(function () {
  "use strict";

  // -------- Sidebar active link --------
  function markActiveLink() {
    const here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav a").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      if (href === here || (here === "" && href === "index.html")) {
        a.classList.add("active");
      }
    });
  }

  // -------- Auto TOC from headings --------
  function buildToc() {
    const tocMount = document.getElementById("toc");
    if (!tocMount) return;
    const article = document.querySelector("article") || document.querySelector(".content");
    if (!article) return;

    const headings = article.querySelectorAll("h2, h3");
    if (headings.length === 0) {
      tocMount.style.display = "none";
      return;
    }
    const ul = document.createElement("ul");
    headings.forEach((h, i) => {
      if (!h.id) h.id = "sec-" + i + "-" + (h.textContent || "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const li = document.createElement("li");
      li.className = h.tagName.toLowerCase();
      const a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      ul.appendChild(li);
    });
    const title = document.createElement("div");
    title.className = "toc-title";
    title.textContent = "Sur cette page";
    tocMount.innerHTML = "";
    tocMount.appendChild(title);
    tocMount.appendChild(ul);

    // highlight current section
    const links = tocMount.querySelectorAll("a");
    const byId = new Map();
    links.forEach((l) => byId.set(l.getAttribute("href").slice(1), l));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const link = byId.get(e.target.id);
          if (!link) return;
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    headings.forEach((h) => io.observe(h));
  }

  // -------- Smooth scroll for in-page anchors --------
  function wireSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        const el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#" + id);
      });
    });
  }

  // -------- Mobile menu --------
  function wireMobileMenu() {
    const btn = document.getElementById("menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    if (!btn || !sidebar) return;
    btn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!sidebar.contains(e.target) && e.target !== btn) {
        sidebar.classList.remove("open");
      }
    });
  }

  // -------- Copy buttons on code blocks --------
  function wireCopyButtons() {
    document.querySelectorAll("pre").forEach((pre) => {
      if (pre.dataset.copyInit) return;
      pre.dataset.copyInit = "1";
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copier");
      btn.textContent = "Copier";
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pre.innerText);
          btn.textContent = "Copié ✓";
          setTimeout(() => (btn.textContent = "Copier"), 1500);
        } catch (_) {
          btn.textContent = "Erreur";
        }
      });
      pre.appendChild(btn);
    });
  }

  // -------- Search (basic, client-side) --------
  function wireSearch() {
    const input = document.getElementById("search-input");
    if (!input) return;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = (input.value || "").trim();
        if (!q) return;
        // Send user to the search page with query
        location.href = "search.html?q=" + encodeURIComponent(q);
      }
    });
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(() => {
    markActiveLink();
    buildToc();
    wireSmoothScroll();
    wireMobileMenu();
    wireCopyButtons();
    wireSearch();
  });
})();
