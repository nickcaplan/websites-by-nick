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
  const dark = stored !== "light";
  document.body.classList.toggle("dark", dark);
  theme.setAttribute("aria-pressed", String(dark));
  theme.addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");
    document.body.classList.toggle("dark", dark);
    theme.setAttribute("aria-pressed", String(dark));
    try {
      localStorage.setItem(KEY, dark ? "dark" : "light");
    } catch {
      // storage blocked: keep the toggle working for this page
    }
  });
})();
