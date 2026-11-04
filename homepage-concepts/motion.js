(() => {
  const button = document.querySelector(".motion-toggle");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const theme = document.querySelector(".theme-toggle");
  let dark = false;
  theme.addEventListener("click", () => {
    dark = !dark;
    document.body.classList.toggle("dark", dark);
    theme.setAttribute("aria-pressed", String(dark));
  });
  let paused = false;
  let refreshProjects = () => {};
  const apply = () => {
    document.body.classList.toggle("paused", paused);
    button.textContent = paused ? "Resume motion" : "Pause motion";
    button.setAttribute("aria-pressed", String(paused));
    refreshProjects();
  };
  button.addEventListener("click", () => {
    paused = !paused;
    apply();
  });

  // Hero title types out, then the underline swoosh draws. Without JS or
  // with reduced motion the full title shows and the swoosh draws as before.
  const heroTitle = document.getElementById("hero-title");
  if (heroTitle && !reduced.matches) {
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          [...n.textContent].forEach((ch) => {
            const s = document.createElement("span");
            s.className = "hc";
            s.textContent = ch;
            frag.appendChild(s);
            chars.push(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE && !n.classList.contains("swoosh")) {
          walk(n);
        }
      });
    };
    heroTitle.querySelectorAll(".line").forEach(walk);
    if (chars.length) {
      heroTitle.setAttribute("aria-label", [...heroTitle.querySelectorAll(".line")].map((l) => l.textContent.trim()).join(" "));
      heroTitle.querySelectorAll(".line").forEach((l) => l.setAttribute("aria-hidden", "true"));
      heroTitle.classList.add("will-type");
      const caret = document.createElement("span");
      caret.className = "hero-caret";
      let i = 0;
      chars[0].after(caret);
      const finish = () => {
        chars.forEach((s) => s.classList.add("on"));
        caret.remove();
        heroTitle.classList.add("typed");
      };
      const step = () => {
        if (reduced.matches) return finish();
        if (
          document.body.classList.contains("paused") ||
          document.body.classList.contains("hidden-page")
        ) {
          setTimeout(step, 180);
          return;
        }
        if (i >= chars.length) {
          setTimeout(() => {
            caret.remove();
            heroTitle.classList.add("typed");
          }, 250);
          return;
        }
        chars[i].classList.add("on");
        chars[i].after(caret);
        i += 1;
        setTimeout(step, 65);
      };
      setTimeout(step, 350);
    }
  }

  // Pointer parallax on the composition: fine pointers only, transform-only,
  // rAF-throttled, respects the pause toggle and reduced-motion.
  const comp = document.querySelector(".composition");
  const layers = [...document.querySelectorAll("[data-depth]")];
  const finePointer = matchMedia("(pointer: fine)");
  if (comp && layers.length && finePointer.matches && !reduced.matches) {
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0,
      raf = null;
    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      const off =
        document.body.classList.contains("paused") ||
        document.body.classList.contains("hidden-page") ||
        reduced.matches
          ? 0
          : 1;
      layers.forEach((el) => {
        const d = parseFloat(el.dataset.depth);
        el.style.translate = `${(cx * d * off).toFixed(2)}px ${(cy * d * off).toFixed(2)}px`;
      });
      raf =
        Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05 || off === 0
          ? requestAnimationFrame(tick)
          : null;
      if (off === 0 && cx === 0 && cy === 0) raf = null;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    comp.addEventListener("pointermove", (e) => {
      const r = comp.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      kick();
    });
    comp.addEventListener("pointerleave", () => {
      tx = 0;
      ty = 0;
      kick();
    });
  }

  // One-time scroll reveals; content is fully visible without JavaScript.
  document.body.classList.add("js-reveal");
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      }),
    { threshold: 0.18 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // Scroll-scrubbed project showcase: each screenshot grows into view as it
  // travels up, and the card it covers eases back and dims. Transform/opacity
  // only, rAF-throttled; pause toggle, reduced motion and a hidden page all
  // freeze it, and everything is full-size and fully visible without JS.
  const projects = [...document.querySelectorAll(".work .project")];
  const desktop = window.matchMedia("(min-width: 901px)");
  if (projects.length && !reduced.matches) {
    document.body.classList.add("scrub-stacked");
    let raf2 = null;
    const scrub = () => {
      raf2 = null;
      const off =
        document.body.classList.contains("paused") ||
        document.body.classList.contains("hidden-page") ||
        reduced.matches;
      const vh = window.innerHeight;
      const stacked = desktop.matches;
      projects.forEach((card, i) => {
        const shot = card.querySelector(".project-image");
        const next = projects[i + 1];
        if (off) {
          card.style.transform = "";
          card.style.opacity = "";
          card.style.pointerEvents = "";
          card.removeAttribute("tabindex");
          if (shot) shot.style.transform = "";
          return;
        }
        if (shot) {
          const r = card.getBoundingClientRect();
          const g = Math.min(Math.max((vh - r.top) / (vh * 0.75), 0), 1);
          shot.style.transform = `scale(${(0.93 + g * 0.07).toFixed(4)})`;
        }
        if (next) {
          const nr = next.getBoundingClientRect();
          const p = Math.min(Math.max((vh - nr.top) / vh, 0), 1);
          if (stacked) {
            card.style.transform = `scale(${(1 - p * 0.05).toFixed(4)})`;
            card.style.opacity = (1 - p * 0.35).toFixed(3);
            const covered = nr.top <= 96;
            card.style.pointerEvents = covered ? "none" : "";
            if (covered) card.setAttribute("tabindex", "-1");
            else card.removeAttribute("tabindex");
          } else {
            card.style.transform = "";
            card.style.opacity = "";
            card.style.pointerEvents = "";
            card.removeAttribute("tabindex");
          }
        }
      });
    };
    const kick2 = () => {
      if (!raf2) raf2 = requestAnimationFrame(scrub);
    };
    refreshProjects = kick2;
    addEventListener("scroll", kick2, { passive: true });
    addEventListener("resize", kick2);
    kick2();
  }

  // Motion is decorative, finite and never moves navigation or page layout.
  // The complete composition and every route remain usable without JavaScript.
  const syncVisibility = () => {
    document.body.classList.toggle("hidden-page", document.hidden);
    refreshProjects();
  };
  syncVisibility();
  document.addEventListener("visibilitychange", syncVisibility);
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      paused = true;
      apply();
    }
  });
})();
