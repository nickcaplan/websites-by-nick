(() => {
  const theme = document.querySelector(".theme-toggle");
  if (!theme) return;
  theme.addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");
    document.body.classList.toggle("dark", dark);
    theme.setAttribute("aria-pressed", String(dark));
  });
})();
