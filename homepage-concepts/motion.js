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
  // Motion is decorative, finite and never moves navigation or page layout.
  // The complete composition and every route remain usable without JavaScript.
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("hidden-page", document.hidden);
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      paused = true;
      apply();
    }
  });
})();
