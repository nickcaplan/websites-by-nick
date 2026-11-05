(() => {
  const theme = document.querySelector(".theme-toggle");
  if (!theme) return;
  const KEY = "wbn-theme";
  const stored = localStorage.getItem(KEY);
  const dark = stored
    ? stored === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", dark);
  theme.setAttribute("aria-pressed", String(dark));
  theme.addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");
    document.body.classList.toggle("dark", dark);
    theme.setAttribute("aria-pressed", String(dark));
    localStorage.setItem(KEY, dark ? "dark" : "light");
  });
})();
