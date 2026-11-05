(() => {
  const button = document.querySelector(".motion-toggle");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const theme = document.querySelector(".theme-toggle");
  const THEME_KEY = "nick-theme";
  const readTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null; // storage blocked: fall back to the system scheme
    }
  };
  const storedTheme = readTheme();
  let dark = storedTheme
    ? storedTheme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", dark);
  theme.setAttribute("aria-pressed", String(dark));
  theme.addEventListener("click", () => {
    dark = !dark;
    document.body.classList.toggle("dark", dark);
    theme.setAttribute("aria-pressed", String(dark));
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // storage blocked: keep the toggle working for this page
    }
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
      chars.forEach((s) => s.setAttribute("aria-hidden", "true"));
      heroTitle.classList.add("will-type");
      const caret = document.createElement("span");
      caret.className = "hero-caret";
      caret.setAttribute("aria-hidden", "true");
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
  // Option E ("Remember it"): after the first draw settles, hovering,
  // tapping or pressing Enter/Space on "remember." redraws the underline
  // with a small wobble. Decorative only: the pause toggle and reduced
  // motion suppress it, and it never interrupts the first draw.
  const rememberWord = heroTitle && heroTitle.querySelector(".line.last em");
  const heroSwoosh = heroTitle && heroTitle.querySelector(".swoosh");
  let replayWired = false;
  const wireReplay = () => {
    if (replayWired || !rememberWord || !heroSwoosh || reduced.matches) return;
    replayWired = true;
    rememberWord.setAttribute("tabindex", "0");
    rememberWord.setAttribute("role", "button");
    rememberWord.setAttribute("aria-label", "remember. Replay the underline");
  };
  const unwireReplay = () => {
    if (!replayWired) return;
    replayWired = false;
    rememberWord.removeAttribute("tabindex");
    rememberWord.removeAttribute("role");
    rememberWord.removeAttribute("aria-label");
  };
  if (rememberWord && heroSwoosh) {
    let redrawing = false;
    const endRedraw = () => {
      heroSwoosh.classList.remove("redraw");
      redrawing = false;
    };
    heroSwoosh.addEventListener("animationend", (e) => {
      if (e.animationName === "swoosh-redraw") endRedraw();
    });
    heroSwoosh.addEventListener("animationcancel", (e) => {
      if (e.animationName === "swoosh-redraw") endRedraw();
    });
    const redraw = () => {
      if (redrawing) return;
      if (reduced.matches) return;
      if (document.body.classList.contains("paused")) return;
      if (!heroTitle.classList.contains("drawn")) return;
      redrawing = true;
      heroSwoosh.classList.add("redraw");
    };
    wireReplay();
    rememberWord.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") redraw();
    });
    rememberWord.addEventListener("click", redraw);
    rememberWord.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        redraw();
      }
    });
  }

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
      const active = !(
        document.body.classList.contains("paused") ||
        document.body.classList.contains("hidden-page") ||
        reduced.matches
      );
      // While motion is off the layers sit at neutral; ease the tracked
      // position back to neutral as well, so resuming never snaps to
      // wherever the pointer happened to wander. The factor keeps the
      // settle immediate: no drift while paused.
      const on = active ? 1 : 0;
      const gx = active ? tx : 0;
      const gy = active ? ty : 0;
      cx += (gx - cx) * 0.08;
      cy += (gy - cy) * 0.08;
      layers.forEach((el) => {
        const d = parseFloat(el.dataset.depth);
        el.style.translate = `${(cx * d * on).toFixed(2)}px ${(cy * d * on).toFixed(2)}px`;
      });
      // Stop the loop once the layers have settled; the next pointer move
      // restarts it.
      raf =
        Math.abs(gx - cx) > 0.05 || Math.abs(gy - cy) > 0.05
          ? requestAnimationFrame(tick)
          : null;
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
          card.style.removeProperty("--dim");
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
            card.style.setProperty("--dim", (p * 0.35).toFixed(3));
            const covered = nr.top <= 96;
            card.style.pointerEvents = covered ? "none" : "";
            if (covered) card.setAttribute("tabindex", "-1");
            else card.removeAttribute("tabindex");
          } else {
            card.style.transform = "";
            card.style.removeProperty("--dim");
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


  // Studio scene: Nick draws this very homepage by hand as the scene scrolls
  // in. The pen follows the real strokes; the arm runs from his shoulder to
  // the pen with a natural bend at the elbow that stays out at his side, and
  // it never stretches. Without JS, with reduced motion or while motion is
  // paused the finished drawing is shown instead. Replays when re-entered.
  const studioSvg = document.querySelector(".studio svg");
  if (studioSvg) {
    const q = (sel) => studioSvg.querySelector(sel);
    const arm = q(".sd-arm"),
      hand = q(".sd-hand"),
      bodyG = q(".sd-body"),
      clip = q(".sd-clip");
    const SH = { x: 390, y: 262 };
    const BASE = 56; // the figure stands close to the board
    const REST = { x: 470, y: 310 };
    // Shoulder, elbow, hand. The arm is short relative to the board, so he leans
    // toward the canvas as he reaches. The upper arm blends between hanging at
    // his side (hand near the body) and pointing at the pen (hand far away),
    // always angling down and out to his right: the elbow never crosses his
    // torso and the arm never reads as two crossed arms or as stretching.
    const L1 = 135;
    const pose = (P) => {
      const dx = Math.max(0, Math.min(100, ((P.x - 500) / 220) * 100));
      const S = { x: SH.x + dx, y: SH.y };
      const H = { x: P.x - 20, y: P.y + 20 };
      const d = Math.hypot(H.x - S.x, H.y - S.y) || 1;
      const ux = (H.x - S.x) / d, uy = (H.y - S.y) / d;
      // 0 when the hand is at his side, 1 at full reach; a floor keeps a
      // slight outward angle even at full stretch, so the elbow always reads.
      const w = Math.max(0.18, 1 - Math.pow(Math.max(0, Math.min(1, (d - 60) / 200)), 0.8));
      let d1x = ux + (0.35 - ux) * w,
        d1y = uy + (0.94 - uy) * w;
      const dn = Math.hypot(d1x, d1y) || 1;
      d1x /= dn;
      d1y /= dn;
      const ex = S.x + L1 * d1x,
        ey = S.y + L1 * d1y;
      arm.setAttribute("d", `M${S.x.toFixed(1)} ${S.y}L${ex.toFixed(1)} ${ey.toFixed(1)}L${H.x.toFixed(1)} ${H.y.toFixed(1)}`);
      hand.setAttribute("transform", `translate(${H.x.toFixed(1)} ${H.y.toFixed(1)})`);
      bodyG.setAttribute("transform", `translate(${(BASE + dx).toFixed(1)} 0)`);
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
        dur: 1300,
        el: null,
        // The wipe chases the pen tip with a fixed 22px lag, so no letter
        // appears before the pen reaches it. Once the tip passes the measured
        // headline end (x=704, t=0.888) the wipe catches up over the remaining
        // blank board, opening fully (300) as the step ends.
        pos: (t) => ({ x: 480 + 250 * t, y: 140 + Math.sin(t * 22) * 10 }),
        show: (t) => {
          const w = t <= 0.888 ? 250 * t : 222 + ((t - 0.888) / 0.112) * 78;
          clip.setAttribute("width", String(Math.max(0, Math.min(300, w))));
        },
      },
      strokeStep(".sd-swoosh", 380),
      strokeStep(".sd-subline", 260),
      strokeStep(".sd-btn", 420, ".sd-btn-fill"),
      strokeStep(".sd-card1", 320, ".sd-card1-fill"),
      strokeStep(".sd-card2", 320, ".sd-card2-fill"),
      strokeStep(".sd-card3", 320, ".sd-card3-fill"),
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
    const setState = (s) => {
      state = s;
      studioSvg.dataset.state = s;
    };
    let step = 0,
      stepStart = 0,
      travelFrom = REST,
      raf3 = null,
      last = 0,
      clock = 0;
    const TRAVEL = 200;
    const isOff = () =>
      document.body.classList.contains("paused") ||
      document.body.classList.contains("hidden-page");
    const ease = (t) => t * t * (3 - 2 * t);
    const frame = (now) => {
      raf3 = null;
      if (state !== "running") return;
      if (document.body.classList.contains("paused") || reduced.matches) {
        setState("complete");
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
          studioSvg.dataset.step = String(step);
          stepStart = clock;
          if (step >= steps.length) {
            setState("ending");
          }
        }
      }
      if (state === "ending") {
        const t0 = clock;
        const endStart = t0;
        const wrap = (n) => {
          raf3 = null;
          if (document.body.classList.contains("paused") || reduced.matches) {
            setState("complete");
            finish();
            return;
          }
          const d2 = isOff() ? 0 : Math.min(n - last, 64);
          last = n;
          clock += d2;
          const k = Math.min((clock - endStart) / 400, 1);
          const e = ease(k);
          pose({
            x: travelFrom.x + (REST.x - travelFrom.x) * e,
            y: travelFrom.y + (REST.y - travelFrom.y) * e,
          });
          if (k >= 1) {
            setState("complete");
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
      setState("running");
      step = 0;
      studioSvg.dataset.step = "0";
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
          if (
            en.isIntersecting &&
            en.intersectionRatio >= 0.45 &&
            !seen &&
            (state === "idle" || state === "complete")
          ) {
            seen = true;
            begin();
          } else if (!en.isIntersecting) {
            seen = false; // replay next time it scrolls into view, even if it left mid-draw
          }
        }),
      { threshold: [0, 0.45] }
    );
    sio.observe(studioSvg);
    const pauseWatch = new MutationObserver(() => {
      if (document.body.classList.contains("paused") && state === "running") {
        setState("complete");
        finish();
      }
    });
    pauseWatch.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    pose(REST);
  }

  // Motion is decorative, finite and never moves navigation or page layout.
  // The complete composition and every route remain usable without JavaScript.
  const syncVisibility = () => {
    document.body.classList.toggle("hidden-page", document.hidden);
    refreshProjects();
  };
  syncVisibility();
  document.addEventListener("visibilitychange", syncVisibility);
  let pausedBeforeReduced = null;
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      pausedBeforeReduced = paused;
      paused = true;
      apply();
      // The replay control is suppressed under reduced motion; drop its
      // button semantics so keyboard users never land on a dead control.
      unwireReplay();
    } else if (pausedBeforeReduced !== null) {
      // Restore the visitor's own pause choice, not a blanket unpause.
      paused = pausedBeforeReduced;
      pausedBeforeReduced = null;
      apply();
      wireReplay(); // bring the replay control back
    }
  });
})();
