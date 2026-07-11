(function () {
  "use strict";

  const panel = document.querySelector("[data-demo-theme]");
  const toggle = document.querySelector("[data-demo-toggle]");
  const runAudit = document.querySelector("[data-run-audit]");
  const auditRoot = document.querySelector("[data-audit-root]");
  const auditResults = document.querySelector("[data-audit-results]");
  const auditStatus = document.querySelector("[data-audit-status]");

  function parseColor(value) {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }

  function luminance(color) {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return (0.2126 * channel(color.r)) + (0.7152 * channel(color.g)) + (0.0722 * channel(color.b));
  }

  function contrastRatio(foreground, background) {
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function effectiveBackground(element) {
    let current = element;
    while (current) {
      const color = parseColor(window.getComputedStyle(current).backgroundColor);
      if (color && color.a > 0.01) return color;
      current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function textContrast(element) {
    const foreground = parseColor(window.getComputedStyle(element).color);
    if (!foreground) return 0;
    return contrastRatio(foreground, effectiveBackground(element));
  }

  function stateBadge(state) {
    const span = document.createElement("span");
    span.dataset.status = state.toLowerCase();
    span.textContent = state;
    return span;
  }

  function renderAuditRows(rows) {
    if (!auditResults) return;
    auditResults.replaceChildren();
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const name = document.createElement("th");
      name.scope = "row";
      name.textContent = row.name;
      const observed = document.createElement("td");
      observed.textContent = row.observed;
      const state = document.createElement("td");
      state.append(stateBadge(row.state));
      tr.append(name, observed, state);
      auditResults.append(tr);
    });
  }

  function auditDemoSurface() {
    if (!panel || !auditRoot) return;

    const sidebarItems = auditRoot.querySelectorAll("[data-audit-item]").length;
    const markdown = auditRoot.querySelector('[data-audit-surface="markdown"] p');
    const code = auditRoot.querySelector('[data-audit-surface="code"] code');
    const textNodes = Array.from(auditRoot.querySelectorAll("p, h2, span, code"));
    const lowContrast = textNodes.filter((element) => textContrast(element) < 4.5);
    const lightIslands = Array.from(auditRoot.querySelectorAll("[data-audit-surface]"))
      .filter((element) => panel.dataset.demoTheme === "dark" && luminance(effectiveBackground(element)) > 0.82);
    const markdownRatio = markdown ? textContrast(markdown) : 0;
    const codeRatio = code ? textContrast(code) : 0;

    const rows = [
      {
        name: "sidebarItems",
        observed: `${sidebarItems} current DOM nodes`,
        state: sidebarItems >= 4 ? "PASS" : "FAIL",
      },
      {
        name: "markdownText",
        observed: markdown ? `${markdown.textContent.trim().length} chars · ${markdownRatio.toFixed(2)}:1` : "surface missing",
        state: markdown && markdownRatio >= 4.5 ? "PASS" : "FAIL",
      },
      {
        name: "darkTextIslands",
        observed: `${lowContrast.length} text nodes below 4.5:1`,
        state: lowContrast.length === 0 ? "PASS" : "FAIL",
      },
      {
        name: "codeBlocks",
        observed: code ? `1 block · ${codeRatio.toFixed(2)}:1` : "0 blocks",
        state: code && codeRatio >= 4.5 ? "PASS" : "FAIL",
      },
      {
        name: "lightIslands",
        observed: `${lightIslands.length} unexpected light surfaces`,
        state: lightIslands.length === 0 ? "PASS" : "FAIL",
      },
    ];

    renderAuditRows(rows);
    const failed = rows.filter((row) => row.state === "FAIL").length;
    panel.dataset.audited = "true";
    if (auditStatus) {
      auditStatus.dataset.status = failed ? "degraded" : "pass";
      auditStatus.textContent = failed ? `DEGRADED · ${failed} FAIL` : "PASS · SAMPLE DOM ONLY";
    }
  }

  if (panel && toggle) {
    toggle.addEventListener("click", function () {
      const next = panel.dataset.demoTheme === "dark" ? "light" : "dark";
      panel.dataset.demoTheme = next;
      toggle.setAttribute("aria-pressed", String(next === "dark"));
      toggle.textContent = next === "dark" ? "Dark signal" : "Light signal";
      if (panel.dataset.audited === "true" && auditStatus) {
        auditStatus.dataset.status = "unknown";
        auditStatus.textContent = "STALE · RUN AGAIN";
        auditResults?.querySelectorAll("[data-status]").forEach((badge) => {
          badge.dataset.status = "unknown";
          badge.textContent = "STALE";
        });
      }
    });
  }

  if (runAudit && auditRoot && auditResults) {
    runAudit.hidden = false;
    runAudit.addEventListener("click", auditDemoSurface);
  }
})();
