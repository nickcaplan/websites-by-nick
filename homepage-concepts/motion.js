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
  let dark = storedTheme !== "light";
  document.body.classList.toggle("dark", dark);

  theme.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  const themeIcon = theme.querySelector(".theme-icon");
  if (themeIcon) themeIcon.textContent = dark ? "☀" : "☾";
  theme.addEventListener("click", () => {
    dark = !dark;
    document.body.classList.toggle("dark", dark);

    theme.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    const themeIcon = theme.querySelector(".theme-icon");
    if (themeIcon) themeIcon.textContent = dark ? "☀" : "☾";
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // storage blocked: keep the toggle working for this page
    }
  });
  let paused = false;
  // Pausing or hiding the tab freezes the title sketch settled; resuming or
  // returning must not clear a drawn window and start the draw again.
  const settleIntro = () => {
    const typedTitle = document.querySelector("h1.will-type.typed");
    if (!typedTitle) return;
    typedTitle.classList.add("drawn");
    if (typedTitle.classList.contains("drawn"))
      typedTitle.classList.add("sketch-settled");
    settleUrl();
  };
  // The address bar earns its keep: once the chrome has drawn, the sketched
  // URL types itself into it with a caret. Settle paths show it complete.
  const chromeSvg = document.querySelector(".penurl");
  const urlText = chromeSvg ? chromeSvg.querySelector(".pf-url") : null;
  const urlCaret = chromeSvg ? chromeSvg.querySelector(".pf-caret") : null;
  let urlChars = [];
  let urlStarted = false;
  let urlFrozen = false;
  const urlTimers = new Set();
  const scheduleUrl = (fn, ms) => {
    if (urlFrozen) return;
    const id = setTimeout(() => {
      urlTimers.delete(id);
      if (!urlFrozen) fn();
    }, ms);
    urlTimers.add(id);
  };
  const urlSettled = () => !urlText || !urlText.querySelector(".pfc");
  // The address keeps playing after the first typing: it holds, backspaces to
  // the "www.your" stem, then types the next option. Settle paths freeze whatever
  // word is showing; reduced-motion and paused visitors never see the cycle.
  const urlStem = "www.your";
  const urlWords = ["business", "idea", "shop", "project"];
  let urlWordIx = 0;
  const buildUrl = (str) => {
    urlText.textContent = "";
    urlChars = [];
    [...str].forEach((ch) => {
      const s = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      s.classList.add("pfc");
      s.textContent = ch;
      urlText.appendChild(s);
      urlChars.push(s);
    });
  };
  const moveUrlCaret = () => {
    let w = 0;
    for (const c of urlChars) {
      if (!c.classList.contains("on")) break;
      try { w += c.getComputedTextLength(); } catch (e) { /* keep the caret where it is */ }
    }
    try { urlCaret.setAttribute("x", String(15 + w + 1)); } catch (e) { /* keep the caret where it is */ }
  };
  const urlStopNow = () => reduced.matches || document.body.classList.contains("paused") || document.body.classList.contains("hidden-page");
  // the dots hop in turn, once: small, quick, then back where they were
  const waveDots = (done) => {
    const all = document.querySelectorAll(".penchrome .pf-dot");
    all.forEach((d, i) => {
      if (!d.animate) return;
      d.animate(
        [
          { transform: "translateY(0) scale(1)", offset: 0 },
          { transform: "translateY(-4.5px) scale(1.25)", offset: 0.4 },
          { transform: "translateY(0.8px) scale(0.95)", offset: 0.7 },
          { transform: "translateY(0) scale(1)", offset: 1 },
        ],
        { duration: 550, delay: i * 130, easing: "ease" }
      );
    });
    scheduleUrl(done, 550 + 2 * 130 + 120);
  };
  let urlRewrites = 0;
  const cycleUrl = () => {
    if (urlStopNow()) return settleUrl();
    // only two rewrites: initial address, wave, rewrite, wave, rewrite, done
    if (urlRewrites >= 0) return settleUrl();
    urlRewrites += 1;
    waveDots(() => {
      if (urlStopNow()) return settleUrl();
      rewriteUrl();
    });
  };
  const rewriteUrl = () => {
    let on = urlChars.length;
    const typeNext = () => {
      urlWordIx = (urlWordIx + 1) % urlWords.length;
      buildUrl(urlStem + urlWords[urlWordIx] + ".co.uk");
      for (let k = 0; k < urlStem.length; k++) urlChars[k].classList.add("on");
      let k = urlStem.length;
      const typ = () => {
        if (urlStopNow()) return settleUrl();
        if (k >= urlChars.length) {
          moveUrlCaret();
          scheduleUrl(cycleUrl, 450);
          return;
        }
        urlChars[k].classList.add("on");
        k += 1;
        moveUrlCaret();
        scheduleUrl(typ, 26);
      };
      scheduleUrl(typ, 120);
    };
    const del = () => {
      if (urlStopNow()) return settleUrl();
      if (on <= urlStem.length) {
        typeNext();
        return;
      }
      on -= 1;
      urlChars[on].classList.remove("on");
      moveUrlCaret();
      scheduleUrl(del, 14);
    };
    del();
  };
  const settleUrl = () => {
    urlFrozen = true;
    urlTimers.forEach(clearTimeout);
    urlTimers.clear();
    if (!urlText) return;
    urlChars.forEach((s) => s.classList.add("on"));
    if (chromeSvg) chromeSvg.classList.remove("url-typing");
    if (heroTitle) heroTitle.classList.add("url-ready");
    urlStarted = true;
  };
  const startUrl = () => {
    if (!urlText || urlStarted) return;
    urlStarted = true;
    if (reduced.matches || document.body.classList.contains("paused") || document.body.classList.contains("hidden-page")) {
      settleUrl();
      return;
    }
    if (!urlChars.length) {
      // JS off or reduced visitors keep the plain text; split only when animating
      buildUrl(urlText.textContent);
    }
    if (heroTitle) heroTitle.classList.add("url-ready");
    chromeSvg.classList.add("url-typing");
    let i = 0;
    const urlStep = () => {
      if (urlStopNow()) return settleUrl();
      if (i >= urlChars.length) {
        moveUrlCaret();
        scheduleUrl(cycleUrl, 700);
        return;
      }
      urlChars[i].classList.add("on");
      i += 1;
      moveUrlCaret();
      scheduleUrl(urlStep, 32);
    };
    scheduleUrl(urlStep, 120);
  };
  let refreshProjects = () => {};
  let resetParallax = () => {};
  const apply = () => {
    document.body.classList.toggle("paused", paused);
    if (paused) { settleIntro(); resetParallax(); }
    button.setAttribute("aria-pressed", String(paused));
    refreshProjects();
  };
  button.addEventListener("click", () => {
    paused = !paused;
    apply();
  });

  // Hero title types out, then the sketched browser window draws around it.
  // Without JS or with reduced motion the full title and window show settled.
  const heroTitle = document.getElementById("hero-title");
  if (heroTitle && reduced.matches) heroTitle.classList.add("sketch-settled");
  if (heroTitle && !reduced.matches) {
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          [...n.textContent].forEach((ch) => {
            const s = document.createElement("span");
            s.className = ch === " " ? "hc hc-sp" : "hc";
            s.textContent = ch;
            frag.appendChild(s);
            chars.push(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE) {
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
        heroTitle.classList.add("typed", "drawn", "sketch-settled");
        settleUrl();
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
            // the window starts drawing straight after the title types
            heroTitle.classList.add("typed", "drawn");
            const bar = document.querySelector(".pf-bar");
            if (bar) bar.addEventListener("animationend", () => setTimeout(startUrl, 150), { once: true });
            else setTimeout(startUrl, 4200);
            // a pause or tab-hide landing in this gap must still settle the
            // window, so resume does not erase and redraw it
            if (document.body.classList.contains("paused") || document.body.classList.contains("hidden-page"))
              heroTitle.classList.add("sketch-settled");
          }, 150);
          return;
        }
        chars[i].classList.add("on");
        chars[i].after(caret);
        i += 1;
        setTimeout(step, 40);
      };
      setTimeout(step, 250);
    }
  }

  // the studio caption types itself out when it scrolls into view,
  // echoing the hero headline typing; reduced motion and no-IO keep it static
  const capText = document.querySelector(".type-caption .tc-text");
  if (capText && "IntersectionObserver" in window) {
    const capEl = capText.closest(".type-caption");
    const finalHTML = capText.innerHTML;
    const plain = capText.textContent;
    const settleCap = () => {
      capText.innerHTML = finalHTML;
      capEl.classList.remove("typing");
      capEl.classList.add("typed");
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        if (reduced.matches || document.body.classList.contains("paused")) return;
        // Keep a complete, stable caption available while the visual copy types.
        const accessible = document.createElement("span");
        accessible.className = "sr-only";
        accessible.textContent = plain;
        capEl.prepend(accessible);
        const reserve = document.createElement("span");
        reserve.className = "tc-reserve";
        reserve.innerHTML = finalHTML;
        reserve.setAttribute("aria-hidden", "true");
        capEl.append(reserve);
        capText.setAttribute("aria-hidden", "true");
        capEl.classList.add("typing");
        capText.textContent = "";
        const caret = document.createElement("span");
        caret.className = "tc-caret";
        capText.append(caret);
        let i = 0;
        const tick = () => {
          if (i >= plain.length || document.body.classList.contains("paused") || reduced.matches) {
            caret.remove();
            settleCap();
            return;
          }
          caret.before(document.createTextNode(plain[i]));
          i += 1;
          setTimeout(tick, 45);
        };
        setTimeout(tick, 250);
      },
      { threshold: 0.5 }
    );
    io.observe(capEl);
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
    resetParallax = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      tx = ty = cx = cy = 0;
      layers.forEach(el => { el.style.translate = "0px 0px"; });
    };
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
  if ("IntersectionObserver" in window) {
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
  }

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
        reduced.matches || document.body.classList.contains("project-focus");
      const vh = window.innerHeight;
      const stacked = desktop.matches && projects.every(card => card.offsetHeight + 96 <= vh);
      document.body.classList.toggle("project-unstacked", !stacked);
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
            card.removeAttribute("tabindex");
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
    const work = document.querySelector(".work");
    let pointerFocus = false;
    work.addEventListener("pointerdown", () => { pointerFocus = true; });
    addEventListener("pointerup", () => {
      pointerFocus = false;
      // Let the native click dispatch before restoring the pointer deck.
      setTimeout(() => {
        if (document.body.classList.contains("project-focus")) {
          document.body.classList.remove("project-focus");
          kick2();
        }
      }, 0);
    });
    addEventListener("pointercancel", () => { pointerFocus = false; });
    addEventListener("keydown", () => { pointerFocus = false; }, true);
    work.addEventListener("focusin", event => {
      if (pointerFocus) return;
      document.body.classList.add("project-focus");
      scrub();
      const focused = event.target.closest(".project");
      if (focused) focused.scrollIntoView({ block: "center", behavior: "instant" });
    });
    work.addEventListener("focusout", event => {
      if (!work.contains(event.relatedTarget)) {
        document.body.classList.remove("project-focus");
        kick2();
      }
    });
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
  if (studioSvg && "IntersectionObserver" in window) {
    const q = (sel) => studioSvg.querySelector(sel);
    const arm = q(".sd-arm"),
      hand = q(".sd-hand"),
      bodyG = q(".sd-body"),
      clip = q(".sd-clip");
    const BASE = 24; // the figure stands a step back from the board
    const SH = { x: BASE + 352, y: 262 }; // his right shoulder, on the torso's edge
    const REST = { x: 470, y: 310 };
    // Two bones of fixed length, so the arm never stretches or shrinks as the
    // pen moves. The elbow always bends down, away from his body, and he leans
    // toward the board (dx) as the pen travels right.
    const L = 135;
    const pose = (P) => {
      const dx = Math.max(0, Math.min(110, ((P.x - 480) / 220) * 110));
      const S = { x: SH.x + dx, y: SH.y };
      let H = { x: P.x - 20, y: P.y + 20 };
      let d = Math.hypot(H.x - S.x, H.y - S.y) || 1;
      const ux = (H.x - S.x) / d, uy = (H.y - S.y) / d;
      if (d > 2 * L - 1) {
        d = 2 * L - 1;
        H = { x: S.x + ux * d, y: S.y + uy * d };
      }
      const a = d / 2, h = Math.sqrt(Math.max(0, L * L - a * a));
      // the perpendicular to the shoulder-hand line that points down
      const px = ux >= 0 ? -uy : uy, py = ux >= 0 ? ux : -ux;
      const ex = S.x + ux * a + px * h,
        ey = S.y + uy * a + py * h;
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
    if (document.hidden) { settleIntro(); resetParallax(); }
    refreshProjects();
  };
  syncVisibility();
  document.addEventListener("visibilitychange", syncVisibility);
  let pausedBeforeReduced = null;
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      if (pausedBeforeReduced === null) pausedBeforeReduced = paused;
      paused = true;
      resetParallax();
      apply();
    } else if (pausedBeforeReduced !== null) {
      // Restore the visitor's own pause choice, not a blanket unpause.
      paused = pausedBeforeReduced;
      pausedBeforeReduced = null;
      apply();
    }
  });
})();
