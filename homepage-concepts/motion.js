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
  const apply = () => {
    document.body.classList.toggle("paused", paused);
    button.textContent = paused ? "Resume motion" : "Pause motion";
    button.setAttribute("aria-pressed", String(paused));
  };
  button.addEventListener("click", () => {
    paused = !paused;
    apply();
  });

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

  // Motion is decorative, finite and never moves navigation or page layout.
  // The complete composition and every route remain usable without JavaScript.
  const syncVisibility = () => {
    document.body.classList.toggle("hidden-page", document.hidden);
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
