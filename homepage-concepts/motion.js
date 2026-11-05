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
    const typedTitle = document.querySelector("h1.will-type.typed");
    if (paused && typedTitle) typedTitle.classList.add("drawn");
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
        heroTitle.classList.add("typed", "drawn");
      };
      const step = () => {
        if (reduced.matches) return finish();
        if (document.body.classList.contains("paused")) return finish();
        if (document.body.classList.contains("hidden-page")) {
          setTimeout(step, 180);
          return;
        }
        if (i >= chars.length) {
          setTimeout(() => {
            caret.remove();
            heroTitle.classList.add("typed");
            heroTitle
              .querySelector(".swoosh")
              .addEventListener(
                "animationend",
                () => heroTitle.classList.add("drawn"),
                { once: true },
              );
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
        const stage = shot && shot.querySelector(".cmp-stage");
        const cmps = stage ? [...stage.querySelectorAll(".cmp")] : [];
        const next = projects[i + 1];
        if (off) {
          card.style.transform = "";
          card.style.opacity = "";
          card.style.pointerEvents = "";
          card.removeAttribute("tabindex");
          if (shot) shot.style.transform = "";
          if (stage) stage.classList.remove("building");
          return;
        }
        if (shot) {
          const r = card.getBoundingClientRect();
          const g = Math.min(Math.max((vh - r.top) / (vh * 0.75), 0), 1);
          shot.style.transform = `scale(${(0.93 + g * 0.07).toFixed(4)})`;
          // Each real component of the screenshot arrives in turn as the card
          // travels in - nav, hero, links, bio - like being assembled live.
          if (stage) {
            stage.classList.add("building");
            const n = cmps.length;
            cmps.forEach((m, k) =>
              m.classList.toggle("on", g >= ((k + 1) / (n + 1)) * 0.92)
            );
          }
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


  // Studio scene: Nick draws a small website by hand as the scene scrolls in.
  // The pen follows the real strokes; the arm is a stretchy cartoon arm from
  // his shoulder to the pen. Without JS, with reduced motion or while motion
  // is paused the finished drawing is shown instead. Replays when re-entered.
  const studioSvg = document.querySelector(".studio svg");
  if (studioSvg) {
    const q = (sel) => studioSvg.querySelector(sel);
    const arm = q(".sd-arm"),
      hand = q(".sd-hand"),
      bodyG = q(".sd-body"),
      clip = q(".sd-clip");
    const SH = { x: 330, y: 262 };
    const REST = { x: 520, y: 330 };
    const pose = (P) => {
      const dx = Math.max(0, Math.min(40, ((P.x - 480) / 340) * 40));
      const S = { x: SH.x + dx, y: SH.y };
      const H = { x: P.x - 22, y: P.y + 22 };
      const d = Math.hypot(H.x - S.x, H.y - S.y);
      const cx = (S.x + H.x) / 2,
        cy = (S.y + H.y) / 2 + d * 0.2;
      arm.setAttribute("d", `M${S.x} ${S.y}Q${cx} ${cy} ${H.x} ${H.y}`);
      hand.setAttribute("transform", `translate(${H.x} ${H.y})`);
      bodyG.setAttribute("transform", `translate(${dx} 0)`);
    };
    const strokeStep = (sel, dur, fillSel) => {
      const el = q(sel);
      const len = el.getTotalLength();
      return {
        dur,
        len,
        el,
        fill: fillSel ? q(fillSel) : null,
        pos: (t) => el.getPointAtLength(len * t),
        show: (t) => {
          el.style.strokeDasharray = len;
          el.style.strokeDashoffset = len * (1 - t);
        },
      };
    };
    const steps = [
      {
        dur: 2800,
        el: null,
        pos: (t) => ({ x: 486 + 300 * t, y: 116 + Math.sin(t * 22) * 15 }),
        show: (t) => clip.setAttribute("width", String(Math.max(0, 350 * t))),
      },
      strokeStep(".sd-underline", 750),
      strokeStep(".sd-line1", 450),
      strokeStep(".sd-line2", 400),
      strokeStep(".sd-btn", 950, ".sd-btn-fill"),
      strokeStep(".sd-pic", 1000, ".sd-pic-fill"),
      strokeStep(".sd-sun", 800),
      strokeStep(".sd-hill", 600),
    ];
    const reset = () => {
      studioSvg.classList.remove("done");
      clip.setAttribute("width", "0");
      steps.forEach((s) => {
        s.show(0);
        if (s.fill) s.fill.classList.remove("on");
      });
    };
    const finish = () => {
      steps.forEach((s) => {
        s.show(1);
        if (s.fill) s.fill.classList.add("on");
      });
      pose(REST);
      studioSvg.classList.add("done");
    };
    let state = "idle"; // idle | running | complete
    let step = 0,
      stepStart = 0,
      travelFrom = REST,
      raf3 = null,
      last = 0,
      clock = 0;
    const TRAVEL = 380;
    const isOff = () =>
      document.body.classList.contains("paused") ||
      document.body.classList.contains("hidden-page");
    const ease = (t) => t * t * (3 - 2 * t);
    const frame = (now) => {
      raf3 = null;
      if (state !== "running") return;
      if (document.body.classList.contains("paused") || reduced.matches) {
        state = "complete";
        finish();
        return;
      }
      const dt = isOff() ? 0 : Math.min(now - last, 64);
      last = now;
      clock += dt;
      const s = steps[step];
      const since = clock - stepStart;
      const startPt = s.el ? s.pos(0) : s.pos(0);
      if (since < TRAVEL) {
        const k = ease(since / TRAVEL);
        pose({
          x: travelFrom.x + (startPt.x - travelFrom.x) * k,
          y: travelFrom.y + (startPt.y - travelFrom.y) * k,
        });
      } else {
        const t = Math.min((since - TRAVEL) / s.dur, 1);
        const tt = ease(t) * 0.35 + t * 0.65;
        s.show(tt);
        pose(s.pos(tt));
        if (t >= 1) {
          if (s.fill) s.fill.classList.add("on");
          travelFrom = s.pos(1);
          step += 1;
          stepStart = clock;
          if (step >= steps.length) {
            state = "ending";
          }
        }
      }
      if (state === "ending") {
        const t0 = clock;
        const endStart = t0;
        const wrap = (n) => {
          raf3 = null;
          if (document.body.classList.contains("paused") || reduced.matches) {
            state = "complete";
            finish();
            return;
          }
          const d2 = isOff() ? 0 : Math.min(n - last, 64);
          last = n;
          clock += d2;
          const k = Math.min((clock - endStart) / 700, 1);
          const e = ease(k);
          pose({
            x: travelFrom.x + (REST.x - travelFrom.x) * e,
            y: travelFrom.y + (REST.y - travelFrom.y) * e,
          });
          if (k >= 1) {
            state = "complete";
            studioSvg.classList.add("done");
            return;
          }
          raf3 = requestAnimationFrame(wrap);
        };
        raf3 = requestAnimationFrame(wrap);
        return;
      }
      raf3 = requestAnimationFrame(frame);
    };
    const begin = () => {
      if (reduced.matches || document.body.classList.contains("paused")) return;
      studioSvg.classList.add("studio-live");
      reset();
      state = "running";
      step = 0;
      clock = 0;
      stepStart = 0;
      travelFrom = REST;
      last = performance.now();
      pose(REST);
      raf3 = requestAnimationFrame(frame);
    };
    // Keep the finished drawing visible until the scene scrolls into view.
    let seen = false;
    const sio = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio >= 0.45 && !seen && state !== "running") {
            seen = true;
            begin();
          } else if (!en.isIntersecting && seen && state === "complete") {
            seen = false; // replay next time it scrolls into view
          }
        }),
      { threshold: [0, 0.45] }
    );
    sio.observe(studioSvg);
    const pauseWatch = new MutationObserver(() => {
      if (document.body.classList.contains("paused") && state === "running") {
        state = "complete";
        finish();
      }
    });
    pauseWatch.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    pose(REST);

    // Nick's eye follows the pointer (fine pointers only, never while motion
    // is paused or the tab is hidden) and blinks via CSS.
    const eye = q(".sd-eye");
    if (eye && matchMedia("(pointer: fine)").matches && !reduced.matches) {
      let eraf = null;
      document.addEventListener("pointermove", (e) => {
        if (eraf) return;
        const { clientX, clientY } = e;
        eraf = requestAnimationFrame(() => {
          eraf = null;
          if (isOff()) {
            eye.style.translate = "";
            return;
          }
          const r = studioSvg.getBoundingClientRect();
          const k = r.width / 880;
          const dx = clientX - (r.left + 338 * k);
          const dy = clientY - (r.top + 158 * k);
          const d = Math.hypot(dx, dy) || 1;
          const m = Math.min(4.5, d / 90);
          eye.style.translate = `${((dx / d) * m).toFixed(2)}px ${((dy / d) * m).toFixed(2)}px`;
        });
      });
    }
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
