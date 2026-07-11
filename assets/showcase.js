(function () {
  "use strict";

  const panel = document.querySelector("[data-demo-theme]");
  const toggle = document.querySelector("[data-demo-toggle]");

  if (!panel || !toggle) return;

  toggle.addEventListener("click", function () {
    const next = panel.dataset.demoTheme === "dark" ? "light" : "dark";
    panel.dataset.demoTheme = next;
    toggle.setAttribute("aria-pressed", String(next === "dark"));
    toggle.textContent = next === "dark" ? "Dark signal" : "Light signal";
  });
})();
