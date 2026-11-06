(() => {
  const theme = document.querySelector(".theme-toggle");
  if (!theme) return;
  const KEY = "nick-theme";
  const readTheme = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null; // storage blocked: fall back to the system scheme
    }
  };
  const stored = readTheme();
  const dark = stored
    ? stored === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", dark);
  theme.setAttribute("aria-pressed", String(dark));
  theme.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  const themeIcon = theme.querySelector(".theme-icon");
  if (themeIcon) themeIcon.textContent = dark ? "☀" : "☾";
  theme.addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");
    document.body.classList.toggle("dark", dark);
    theme.setAttribute("aria-pressed", String(dark));
    theme.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    const themeIcon = theme.querySelector(".theme-icon");
    if (themeIcon) themeIcon.textContent = dark ? "☀" : "☾";
    try {
      localStorage.setItem(KEY, dark ? "dark" : "light");
    } catch {
      // storage blocked: keep the toggle working for this page
    }
  });
})();
