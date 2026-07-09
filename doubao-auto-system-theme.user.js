// ==UserScript==
// @name         Doubao Web Auto Dark Mode
// @name:zh-CN   豆包网页版自动深色模式
// @namespace    https://github.com/estelledc/doubao-auto-system-theme
// @version      1.0.0
// @description  Make Doubao web chat follow the system theme, with readable dark sidebar history, Markdown, code blocks, composer, and popovers.
// @description:zh-CN  让豆包网页版聊天页跟随系统深浅色，并修复深色下侧栏历史、正文、代码块、输入框和弹窗的可读性。
// @author       Doubao Web Dark Mode Contributors
// @license      MIT
// @homepageURL  https://github.com/estelledc/doubao-auto-system-theme
// @supportURL   https://github.com/estelledc/doubao-auto-system-theme/issues
// @match        https://www.doubao.com/chat/*
// @compatible   chrome Tampermonkey
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '1.0.0';
  const STYLE_ID = 'doubao-auto-system-theme-style';
  const THEME_ATTRS = ['data-theme', 'data-theme-mode', 'theme', 'theme-mode'];
  const DARK_QUERY = '(prefers-color-scheme: dark)';
  const VERIFY_DELAYS = [0, 50, 250, 1000, 3000];
  const MARKDOWN_CONTAINER_SELECTOR =
    '[class*="md-box-root"], .markdown-body, [class*="markdown"], [class*="Markdown"], article';
  const CODE_BLOCK_SELECTOR = '[class*="custom-code-block-container"], [class*="code-block-element"], pre';
  const media = window.matchMedia ? window.matchMedia(DARK_QUERY) : null;

  let applying = false;
  let scheduled = false;
  let dirtyWhileApplying = false;
  let htmlObserver = null;
  let bodyObserver = null;
  let routePatched = false;

  function desiredTheme() {
    return media && media.matches ? 'dark' : 'light';
  }

  function setElementTheme(el, theme) {
    if (!el) return;
    for (const attr of THEME_ATTRS) {
      el.setAttribute(attr, theme);
    }
    el.style.colorScheme = theme;
    el.setAttribute('data-immersive-translate-page-theme', theme);
    el.dataset.doubaoAutoSystemTheme = theme;
  }

  function isThemeDrift(el, theme) {
    if (!el) return false;
    return THEME_ATTRS.some((attr) => el.getAttribute(attr) !== theme);
  }

  function hasAnyThemeDrift(theme) {
    return isThemeDrift(document.documentElement, theme) || isThemeDrift(document.body, theme);
  }

  function applyTheme(reason) {
    const theme = desiredTheme();
    const root = document.documentElement;
    if (!root) return;

    applying = true;
    dirtyWhileApplying = false;
    ensureStyle(theme);
    setElementTheme(root, theme);
    setElementTheme(document.body, theme);

    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.dataset.doubaoAutoSystemThemeReason = reason || 'apply';

    observeTargets();
    window.setTimeout(() => {
      applying = false;
      if (dirtyWhileApplying || hasAnyThemeDrift(theme)) {
        scheduleApply('post-apply-drift');
      }
    }, 0);

    for (const delay of VERIFY_DELAYS) {
      window.setTimeout(() => verifyAndRepair('verify-' + delay), delay);
    }
  }

  function verifyAndRepair(reason) {
    const theme = desiredTheme();
    if (hasAnyThemeDrift(theme)) {
      setElementTheme(document.documentElement, theme);
      setElementTheme(document.body, theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.dataset.doubaoAutoSystemThemeReason = reason || 'repair';
    }
  }

  function scheduleApply(reason) {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(() => {
      const run = () => {
        scheduled = false;
        applyTheme(reason || 'scheduled');
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(run);
      } else {
        window.setTimeout(run, 16);
      }
    });
  }

  function createObserver(target) {
    if (!target || !window.MutationObserver) return null;
    const observer = new MutationObserver((mutations) => {
      const touchedTheme = mutations.some(
        (mutation) => mutation.type === 'attributes' && THEME_ATTRS.includes(mutation.attributeName),
      );
      if (!touchedTheme) return;
      if (applying) {
        dirtyWhileApplying = true;
        return;
      }
      if (hasAnyThemeDrift(desiredTheme())) {
        scheduleApply('theme-drift');
      }
    });
    observer.observe(target, {
      attributes: true,
      attributeFilter: THEME_ATTRS,
    });
    return observer;
  }

  function observeTargets() {
    if (!htmlObserver && document.documentElement) {
      htmlObserver = createObserver(document.documentElement);
    }
    if (!bodyObserver && document.body) {
      bodyObserver = createObserver(document.body);
    }
  }

  function patchRouteChanges() {
    if (routePatched || !window.history) return;
    routePatched = true;

    const wrap = (name) => {
      const original = window.history[name];
      if (typeof original !== 'function') return;
      window.history[name] = function () {
        const result = original.apply(this, arguments);
        scheduleApply('route-' + name);
        return result;
      };
    };

    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', () => scheduleApply('popstate'));
    window.addEventListener('hashchange', () => scheduleApply('hashchange'));
  }

  function ensureStyle(theme) {
    const root = document.documentElement;
    if (!root) return;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.type = 'text/css';
      (document.head || root).appendChild(style);
    }

    if (style.dataset.version !== VERSION) {
      style.textContent = adapterCss();
      style.dataset.version = VERSION;
    }

    style.dataset.theme = theme;
  }

  function adapterCss() {
    return `
      html[data-doubao-auto-system-theme] {
        color-scheme: var(--doubao-auto-color-scheme);
      }

      html[data-doubao-auto-system-theme="dark"] {
        --doubao-auto-color-scheme: dark;
        --doubao-auto-page: #0b0b0b;
        --doubao-auto-main: #171717;
        --doubao-auto-surface: #2b2b2b;
        --doubao-auto-surface-soft: #232323;
        --doubao-auto-surface-muted: #1d1d1d;
        --doubao-auto-hover: rgba(255, 255, 255, 0.075);
        --doubao-auto-active: rgba(255, 255, 255, 0.11);
        --doubao-auto-border: rgba(255, 255, 255, 0.10);
        --doubao-auto-border-strong: rgba(255, 255, 255, 0.16);
        --doubao-auto-text: rgba(255, 255, 255, 0.88);
        --doubao-auto-text-secondary: rgba(255, 255, 255, 0.68);
        --doubao-auto-text-muted: rgba(255, 255, 255, 0.48);
        --doubao-auto-link: #77b0ff;
        --doubao-auto-code-bg: #111;
        --doubao-auto-code-border: rgba(255, 255, 255, 0.13);
        --doubao-auto-selection: rgba(119, 176, 255, 0.28);
        --doubao-auto-composer-shadow: 0 0 0 1px rgba(120,170,255,.22), 0 12px 36px rgba(0,0,0,.30);

        --doubao-md-text: rgba(255,255,255,.88);
        --doubao-md-heading: rgba(255,255,255,.92);
        --doubao-md-secondary: rgba(255,255,255,.72);
        --doubao-md-muted: rgba(255,255,255,.56);
        --doubao-md-link: #8ab4ff;
        --doubao-md-inline-code-bg: rgba(255,255,255,.08);
        --doubao-md-inline-code-border: rgba(255,255,255,.10);
        --doubao-md-quote-bg: rgba(255,255,255,.045);
        --doubao-md-quote-border: rgba(255,255,255,.18);
        --doubao-md-table-header-bg: rgba(255,255,255,.055);
        --doubao-md-table-row-bg: rgba(255,255,255,.018);

        --doubao-code-shell: #1f1f1f;
        --doubao-code-header: #252525;
        --doubao-code-body: #101010;
        --doubao-code-text: rgba(255,255,255,.88);
        --doubao-code-muted: rgba(255,255,255,.56);
        --doubao-code-border: rgba(255,255,255,.12);
        --doubao-code-token-purple: #c792ea;
        --doubao-code-token-green: #8fd18f;
        --doubao-code-token-blue: #82aaff;
        --doubao-code-token-cyan: #89ddff;
        --doubao-code-token-orange: #f6bd72;
        --doubao-code-token-red: #ff8a80;

        --doubao-sidebar-bg: #0f0f0f;
        --doubao-sidebar-item: transparent;
        --doubao-sidebar-item-hover: rgba(255,255,255,.075);
        --doubao-sidebar-item-active: rgba(255,255,255,.11);
        --doubao-sidebar-title: rgba(255,255,255,.86);
        --doubao-sidebar-title-hover: rgba(255,255,255,.94);
        --doubao-sidebar-muted: rgba(255,255,255,.52);
        --doubao-sidebar-icon: rgba(255,255,255,.58);
        --doubao-sidebar-search-bg: #202020;
      }

      html[data-doubao-auto-system-theme="light"] {
        --doubao-auto-color-scheme: light;
        --doubao-auto-page: var(--dbx-bg-body-web, #fcfcfc);
        --doubao-auto-main: var(--dbx-bg-body-web, #fcfcfc);
        --doubao-auto-surface: var(--dbx-bg-float, #fff);
        --doubao-auto-surface-soft: var(--dbx-bg-body-overlay-web, #fff);
        --doubao-auto-surface-muted: var(--dbx-bg-base-2, #f4f4f4);
        --doubao-auto-hover: var(--dbx-fill-trans-10-hover, rgba(0,0,0,.04));
        --doubao-auto-active: var(--dbx-fill-trans-20, rgba(0,0,0,.06));
        --doubao-auto-border: var(--dbx-line-10, rgba(0,0,0,.10));
        --doubao-auto-border-strong: var(--dbx-line-15, rgba(0,0,0,.16));
        --doubao-auto-text: var(--dbx-text-primary, rgba(0,0,0,.88));
        --doubao-auto-text-secondary: var(--dbx-text-secondary, rgba(0,0,0,.62));
        --doubao-auto-text-muted: var(--dbx-text-tertiary, rgba(0,0,0,.42));
        --doubao-auto-link: var(--dbx-text-highlight, #06f);
        --doubao-auto-code-bg: #f6f8fa;
        --doubao-auto-code-border: #d0d7de;
        --doubao-auto-selection: rgba(0, 102, 255, 0.18);
        --doubao-auto-composer-shadow: var(--dbx-shadow-lg, 0 8px 24px rgba(0,0,0,.10));
      }

      html[data-doubao-auto-system-theme="dark"],
      html[data-doubao-auto-system-theme="dark"] body,
      html[data-doubao-auto-system-theme="dark"] #root,
      html[data-doubao-auto-system-theme="dark"] #chat-route-main {
        background: var(--doubao-auto-page);
        color: var(--doubao-auto-text);
      }

      html[data-doubao-auto-system-theme="dark"] main[data-container-name="main"],
      html[data-doubao-auto-system-theme="dark"] main {
        background-color: var(--doubao-auto-main);
        color: var(--doubao-auto-text);
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"],
      html[data-doubao-auto-system-theme="dark"] [data-history-container="true"] {
        background-color: var(--doubao-sidebar-bg) !important;
        color: var(--doubao-sidebar-title) !important;
        border-color: var(--doubao-auto-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] input,
      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] [class*="search"],
      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] [role="searchbox"] {
        background-color: var(--doubao-sidebar-search-bg) !important;
        color: var(--doubao-sidebar-title) !important;
        border-color: var(--doubao-auto-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] input::placeholder {
        color: var(--doubao-auto-text-muted) !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] a[id^="conversation_"],
      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] [id^="conversation_"] {
        background-color: var(--doubao-sidebar-item) !important;
        color: var(--doubao-sidebar-title) !important;
        opacity: 1 !important;
        border-color: transparent !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] a[id^="conversation_"] :where(
        [class*="title" i],
        [class*="overallTitle" i],
        [class*="content" i],
        [class*="truncate" i],
        span,
        p
      ),
      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] [id^="conversation_"] :where(
        [class*="title" i],
        [class*="overallTitle" i],
        [class*="content" i],
        [class*="truncate" i],
        span,
        p
      ) {
        color: var(--doubao-sidebar-title) !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] a[id^="conversation_"] :where(
        svg,
        button,
        [role="button"],
        [class*="icon" i],
        [class*="extra" i],
        [class*="menu" i]
      ) {
        color: var(--doubao-sidebar-icon) !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] a[id^="conversation_"] svg :where(path, circle, rect, line, polyline) {
        stroke: currentColor;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] a[id^="conversation_"]:hover,
      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] [id^="conversation_"]:hover {
        background-color: var(--doubao-sidebar-item-hover) !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] a[id^="conversation_"]:hover :where(
        [class*="title" i],
        [class*="overallTitle" i],
        [class*="content" i],
        [class*="truncate" i],
        span,
        p
      ) {
        color: var(--doubao-sidebar-title-hover) !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] a[id^="conversation_"]:where(
        [aria-current="page"],
        [aria-selected="true"],
        [data-active="true"],
        [class*="active" i],
        [class*="selected" i]
      ) {
        background-color: var(--doubao-sidebar-item-active) !important;
        color: var(--doubao-sidebar-title-hover) !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] :where(
        [class*="nav-link" i],
        [class*="sidebar_nav_item" i],
        [class*="group/sidebar_nav_item" i]
      ) {
        color: var(--doubao-sidebar-title) !important;
        border-color: transparent !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] :where(
        [class*="nav-link" i],
        [class*="sidebar_nav_item" i],
        [class*="group/sidebar_nav_item" i]
      ):hover {
        background-color: var(--doubao-sidebar-item-hover) !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] :where(
        [class*="user" i],
        [class*="account" i],
        [class*="bottom" i]
      ) {
        color: var(--doubao-sidebar-title) !important;
      }

      html[data-doubao-auto-system-theme="dark"] nav[class*="left-side"] :where(
        [class*="history" i],
        [class*="section" i],
        [class*="caption" i]
      ) {
        color: var(--doubao-sidebar-muted) !important;
      }

      html[data-doubao-auto-system-theme="dark"] #input-engine-container,
      html[data-doubao-auto-system-theme="dark"] #input-engine-container [class*="input-content-container"],
      html[data-doubao-auto-system-theme="dark"] [class*="input-content-container"] {
        --input-guidance-input-container-background: var(--doubao-auto-surface) !important;
        --input-guidance-input-container-border: 1px solid var(--doubao-auto-border) !important;
        --input-guidance-input-editor-color: var(--doubao-auto-text) !important;
        --input-guidance-input-editor-placeholder-color: var(--doubao-auto-text-muted) !important;
        --s-color-bg-float: var(--doubao-auto-surface) !important;
        --s-color-border-secondary: var(--doubao-auto-border) !important;
        --s-color-text-secondary: var(--doubao-auto-text) !important;
        --s-color-text-quaternary: var(--doubao-auto-text-muted) !important;
      }

      html[data-doubao-auto-system-theme="dark"] #input-engine-container {
        box-shadow: var(--doubao-auto-composer-shadow) !important;
      }

      html[data-doubao-auto-system-theme="dark"] #input-engine-container > div,
      html[data-doubao-auto-system-theme="dark"] #input-engine-container [class*="bg-\\(--input-guidance-input-container-background\\)"],
      html[data-doubao-auto-system-theme="dark"] #input-engine-container [class*="bg-\\[var\\(--input-guidance-input-container-background\\)\\]"] {
        background-color: var(--doubao-auto-surface) !important;
        color: var(--doubao-auto-text) !important;
        border-color: var(--doubao-auto-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] #input-engine-container:focus-within {
        box-shadow: var(--doubao-auto-composer-shadow) !important;
      }

      html[data-doubao-auto-system-theme="dark"] #input-engine-container [contenteditable="true"],
      html[data-doubao-auto-system-theme="dark"] #input-engine-container [role="textbox"],
      html[data-doubao-auto-system-theme="dark"] #input-engine-container .ProseMirror {
        background-color: transparent !important;
        color: var(--doubao-auto-text) !important;
        caret-color: var(--doubao-auto-link) !important;
      }

      html[data-doubao-auto-system-theme="dark"] #input-engine-container [data-placeholder]::before,
      html[data-doubao-auto-system-theme="dark"] #input-engine-container .ProseMirror p.is-editor-empty:first-child::before {
        color: var(--doubao-auto-text-muted) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [data-radix-popper-content-wrapper],
      html[data-doubao-auto-system-theme="dark"] [data-slot="dropdown-menu-content"],
      html[data-doubao-auto-system-theme="dark"] [role="dialog"],
      html[data-doubao-auto-system-theme="dark"] [role="menu"],
      html[data-doubao-auto-system-theme="dark"] .semi-popover,
      html[data-doubao-auto-system-theme="dark"] .semi-dropdown,
      html[data-doubao-auto-system-theme="dark"] .semi-modal,
      html[data-doubao-auto-system-theme="dark"] .semi-toast-content {
        background-color: var(--doubao-auto-surface) !important;
        color: var(--doubao-auto-text) !important;
        border-color: var(--doubao-auto-border) !important;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.36) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [role="menuitem"]:hover,
      html[data-doubao-auto-system-theme="dark"] [data-slot="dropdown-menu-item"]:hover,
      html[data-doubao-auto-system-theme="dark"] .semi-dropdown-item:hover {
        background-color: var(--doubao-auto-hover) !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) {
        color: var(--doubao-md-text) !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(h1, h2, h3, h4, h5, h6) {
        color: var(--doubao-md-heading) !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(p, ol, ul, li, dl, dt, dd, table, thead, tbody, tr, th, td, details, summary) {
        color: var(--doubao-md-text) !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) div:not([class*="custom-code-block-container"]):not([class*="code-block-element"]):not([class*="code-area"]):not([class*="code-content"]):not([class*="header-wrapper"]) {
        color: var(--doubao-md-text) !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(li)::marker {
        color: var(--doubao-md-secondary) !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(p, li, h1, h2, h3, h4, h5, h6, th, td, summary, details) > span:not(.token) {
        color: inherit !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) div:not([class*="custom-code-block-container"]):not([class*="code-block-element"]):not([class*="code-area"]):not([class*="code-content"]):not([class*="header-wrapper"]) :where(span:not(.token)) {
        color: inherit !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(strong, b) {
        color: inherit !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(em, i, del, small, figcaption) {
        color: var(--doubao-md-secondary) !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(a, a:visited) {
        color: var(--doubao-md-link) !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) a:hover {
        text-decoration: underline;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(p, li, td, th, summary, div) code:not(pre code),
      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(p, li, td, th, summary, div) kbd,
      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(p, li, td, th, summary, div) samp {
        background-color: var(--doubao-md-inline-code-bg) !important;
        color: var(--doubao-md-text) !important;
        border-color: var(--doubao-md-inline-code-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) blockquote {
        background-color: var(--doubao-md-quote-bg) !important;
        color: var(--doubao-md-secondary) !important;
        border-color: var(--doubao-md-quote-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) blockquote :where(p, li, strong, b, em, i, span:not(.token)) {
        color: var(--doubao-md-secondary) !important;
        opacity: 1 !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) :where(table, th, td) {
        border-color: var(--doubao-auto-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) th {
        background-color: var(--doubao-md-table-header-bg) !important;
        color: var(--doubao-md-heading) !important;
      }

      html[data-doubao-auto-system-theme="dark"] :where(
        [class*="md-box-root"],
        .markdown-body,
        [class*="markdown"],
        [class*="Markdown"],
        article
      ) td {
        background-color: var(--doubao-md-table-row-bg) !important;
        color: var(--doubao-md-text) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"],
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] {
        background-color: var(--doubao-code-shell) !important;
        color: var(--doubao-code-text) !important;
        border: 1px solid var(--doubao-code-border) !important;
        border-radius: 8px !important;
        overflow: hidden !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"].light,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"].light {
        background-color: var(--doubao-code-shell) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="code-area"],
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="code-area"] {
        background-color: var(--doubao-code-shell) !important;
        color: var(--doubao-code-text) !important;
        border-color: var(--doubao-code-border) !important;
        border-radius: 8px !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="header-wrapper"],
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="header-wrapper"] {
        background-color: var(--doubao-code-header) !important;
        background-image: none !important;
        color: var(--doubao-code-muted) !important;
        border-color: var(--doubao-code-border) !important;
        border-bottom: 1px solid var(--doubao-code-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where([class*="header" i], [class*="toolbar" i]),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where([class*="header" i], [class*="toolbar" i]) {
        background-color: var(--doubao-code-header) !important;
        background-image: none !important;
        color: var(--doubao-code-muted) !important;
        border-color: var(--doubao-code-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="header-wrapper"] *,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="header-wrapper"] *,
      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where([class*="header" i], [class*="toolbar" i]) *,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where([class*="header" i], [class*="toolbar" i]) * {
        color: var(--doubao-code-muted) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="header-wrapper"] :where(button, [role="button"]),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="header-wrapper"] :where(button, [role="button"]),
      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where([class*="header" i], [class*="toolbar" i]) :where(button, [role="button"], [class*="title" i], [class*="clickable" i]),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where([class*="header" i], [class*="toolbar" i]) :where(button, [role="button"], [class*="title" i], [class*="clickable" i]) {
        background-color: transparent !important;
        background-image: none !important;
        color: var(--doubao-code-muted) !important;
        border-color: transparent !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="header-wrapper"] :where(button, [role="button"]):hover,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="header-wrapper"] :where(button, [role="button"]):hover,
      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where([class*="header" i], [class*="toolbar" i]) :where(button, [role="button"], [class*="clickable" i]):hover,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where([class*="header" i], [class*="toolbar" i]) :where(button, [role="button"], [class*="clickable" i]):hover {
        background-color: rgba(255,255,255,.08) !important;
        color: var(--doubao-code-text) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="header-wrapper"] svg,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="header-wrapper"] svg,
      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where([class*="header" i], [class*="toolbar" i]) svg,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where([class*="header" i], [class*="toolbar" i]) svg {
        color: currentColor !important;
        fill: currentColor !important;
        stroke: currentColor !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where([class*="header" i], [class*="toolbar" i]) svg :where(path, circle, rect, line, polyline),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where([class*="header" i], [class*="toolbar" i]) svg :where(path, circle, rect, line, polyline) {
        fill: currentColor !important;
        stroke: currentColor !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="code-content"],
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="code-content"] {
        background-color: var(--doubao-code-body) !important;
        color: var(--doubao-code-text) !important;
        border-color: var(--doubao-code-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where([class*="mask" i], [class*="fade" i], [class*="gradient" i]),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where([class*="mask" i], [class*="fade" i], [class*="gradient" i]) {
        background-color: transparent !important;
        background-image: linear-gradient(rgba(16,16,16,0), var(--doubao-code-body)) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] pre,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] pre,
      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] code,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] code {
        background-color: var(--doubao-code-body) !important;
        color: var(--doubao-code-text) !important;
        border-color: var(--doubao-code-border) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] pre,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] pre {
        margin: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] code,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] code,
      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] code *,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] code * {
        text-shadow: none !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.comment, .token.prolog, .token.doctype, .token.cdata),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.comment, .token.prolog, .token.doctype, .token.cdata) {
        color: var(--doubao-code-muted) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.keyword, .token.selector, .token.important, .token.atrule, .token.builtin),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.keyword, .token.selector, .token.important, .token.atrule, .token.builtin) {
        color: var(--doubao-code-token-purple) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.string, .token.attr-value, .token.char, .token.regex),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.string, .token.attr-value, .token.char, .token.regex) {
        color: var(--doubao-code-token-green) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.function, .token.function-definition),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.function, .token.function-definition) {
        color: var(--doubao-code-token-blue) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.class-name, .token.namespace),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.class-name, .token.namespace) {
        color: var(--doubao-code-token-cyan) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.tag, .token.property, .token.number, .token.boolean, .token.constant, .token.symbol, .token.deleted),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.tag, .token.property, .token.number, .token.boolean, .token.constant, .token.symbol, .token.deleted) {
        color: var(--doubao-code-token-orange) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.punctuation, .token.operator, .token.entity, .token.url, .token.variable),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.punctuation, .token.operator, .token.entity, .token.url, .token.variable) {
        color: var(--doubao-code-text) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.inserted, .token.attr-name),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.inserted, .token.attr-name) {
        color: var(--doubao-code-token-green) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] :where(.token.deleted),
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] :where(.token.deleted) {
        color: var(--doubao-code-token-red) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="code-content"]::-webkit-scrollbar-track,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="code-content"]::-webkit-scrollbar-track,
      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] pre::-webkit-scrollbar-track,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] pre::-webkit-scrollbar-track {
        background-color: var(--doubao-code-body) !important;
      }

      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] [class*="code-content"]::-webkit-scrollbar-thumb,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] [class*="code-content"]::-webkit-scrollbar-thumb,
      html[data-doubao-auto-system-theme="dark"] [class*="custom-code-block-container"] pre::-webkit-scrollbar-thumb,
      html[data-doubao-auto-system-theme="dark"] [class*="code-block-element"] pre::-webkit-scrollbar-thumb {
        background-color: rgba(255,255,255,.22) !important;
      }

      html[data-doubao-auto-system-theme="dark"] pre,
      html[data-doubao-auto-system-theme="dark"] table,
      html[data-doubao-auto-system-theme="dark"] th,
      html[data-doubao-auto-system-theme="dark"] td,
      html[data-doubao-auto-system-theme="dark"] blockquote {
        border-color: var(--doubao-auto-border);
      }

      html[data-doubao-auto-system-theme="dark"] blockquote {
        background-color: var(--doubao-auto-surface-muted);
        color: var(--doubao-auto-text-secondary);
      }

      html[data-doubao-auto-system-theme="dark"] a,
      html[data-doubao-auto-system-theme="dark"] a:visited {
        color: var(--doubao-auto-link);
      }

      html[data-doubao-auto-system-theme] ::selection {
        background: var(--doubao-auto-selection);
      }

      html[data-doubao-auto-system-theme="dark"] ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      html[data-doubao-auto-system-theme="dark"] ::-webkit-scrollbar-track {
        background: transparent;
      }

      html[data-doubao-auto-system-theme="dark"] ::-webkit-scrollbar-thumb {
        background-color: var(--doubao-auto-border-strong);
        border: 2px solid transparent;
        border-radius: 999px;
        background-clip: content-box;
      }

      html[data-doubao-auto-system-theme="dark"] ::-webkit-scrollbar-thumb:hover {
        background-color: var(--doubao-auto-text-muted);
      }
    `;
  }

  function parseRgb(value) {
    if (!value) return null;
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1]
      .replace(/\s*\/\s*/, ' ')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part, index) => index < 3 && Number.isNaN(part))) return null;
    return {
      r: parts[0],
      g: parts[1],
      b: parts[2],
      a: parts.length >= 4 && !Number.isNaN(parts[3]) ? parts[3] : 1,
    };
  }

  function blend(fg, bg) {
    const alpha = fg.a == null ? 1 : fg.a;
    return {
      r: fg.r * alpha + bg.r * (1 - alpha),
      g: fg.g * alpha + bg.g * (1 - alpha),
      b: fg.b * alpha + bg.b * (1 - alpha),
      a: 1,
    };
  }

  function luminance(rgb) {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrastRatio(fgValue, bgValue) {
    const fg = parseRgb(fgValue);
    const bg = parseRgb(bgValue) || { r: 15, g: 15, b: 15, a: 1 };
    if (!fg) return null;
    const effectiveFg = fg.a < 1 ? blend(fg, bg) : fg;
    const l1 = luminance(effectiveFg);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  }

  function rgbString(rgb) {
    return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
  }

  function effectiveBackground(el) {
    const fallback = desiredTheme() === 'dark' ? { r: 15, g: 15, b: 15, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    const layers = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1) {
      const bg = getComputedStyle(node).backgroundColor;
      const parsed = parseRgb(bg);
      if (parsed && parsed.a > 0.01) {
        layers.push(parsed);
        if (parsed.a >= 0.99) break;
      }
      node = node.parentElement;
      depth += 1;
      if (depth > 24) break;
    }
    let result = fallback;
    while (layers.length) {
      const layer = layers.pop();
      result = layer.a < 1 ? blend(layer, result) : { r: layer.r, g: layer.g, b: layer.b, a: 1 };
    }
    return rgbString(result);
  }

  function findSidebarTitle(item) {
    const candidates = Array.from(item.querySelectorAll('*'));
    for (const el of candidates) {
      const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
      const text = (el.textContent || '').trim();
      if (!text) continue;
      if (
        className.includes('title') ||
        className.includes('overalltitle') ||
        className.includes('content') ||
        className.includes('truncate')
      ) {
        return el;
      }
    }
    return item;
  }

  function auditSidebarItems() {
    return Array.from(document.querySelectorAll('nav[class*="left-side"] a[id^="conversation_"]'))
      .slice(0, 20)
      .map((item) => {
        const title = findSidebarTitle(item);
        const itemStyle = getComputedStyle(item);
        const titleStyle = getComputedStyle(title);
        const bg = effectiveBackground(item);
        const color = titleStyle.color;
        return {
          id: item.id,
          text: (title.textContent || item.textContent || '').trim().slice(0, 80),
          itemBg: itemStyle.backgroundColor,
          effectiveBg: bg,
          titleColor: color,
          itemColor: itemStyle.color,
          contrast: contrastRatio(color, bg),
          mutedContrast: contrastRatio(itemStyle.color, bg),
        };
      });
  }

  function styleSnapshot(el, backgroundTarget) {
    if (!el) return null;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const bg = backgroundTarget || effectiveBackground(el);
    return {
      tag: el.tagName,
      className: typeof el.className === 'string' ? el.className.slice(0, 180) : '',
      text: (el.textContent || '').trim().slice(0, 80),
      bg: style.backgroundColor,
      effectiveBg: bg,
      color: style.color,
      border: style.borderColor,
      contrast: contrastRatio(style.color, bg),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    };
  }

  function isVisibleElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number.parseFloat(style.opacity || '1') > 0.01 &&
      rect.width > 1 &&
      rect.height > 1
    );
  }

  function isInsideCodeBlock(el) {
    return Boolean(el && el.closest(CODE_BLOCK_SELECTOR));
  }

  function markdownContainers() {
    const seen = new Set();
    return Array.from(document.querySelectorAll(MARKDOWN_CONTAINER_SELECTOR))
      .filter((container) => {
        if (seen.has(container) || !isVisibleElement(container) || isInsideCodeBlock(container)) return false;
        seen.add(container);
        return true;
      })
      .slice(0, 20);
  }

  function markdownCategory(el) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'blockquote') return 'quote';
    if (el.closest('blockquote')) return 'quote-text';
    if (tag === 'code' || tag === 'kbd' || tag === 'samp') return 'inline-code';
    if (tag === 'th' || tag === 'td' || el.closest('table')) return 'table';
    if (tag === 'li' || el.closest('li')) return 'list';
    return 'body';
  }

  function markdownThreshold(category) {
    if (category === 'quote' || category === 'quote-text') return 4.5;
    return 7;
  }

  function auditMarkdownText() {
    const samples = [];
    const seen = new Set();
    const sampleSelector = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'div',
      'li',
      'blockquote',
      'blockquote p',
      'blockquote li',
      'th',
      'td',
      'summary',
      'details',
      'p code',
      'li code',
      'td code',
      'th code',
      'summary code',
      'p kbd',
      'li kbd',
      'p samp',
      'li samp',
    ].join(', ');

    for (const container of markdownContainers()) {
      for (const el of Array.from(container.querySelectorAll(sampleSelector))) {
        if (seen.has(el) || isInsideCodeBlock(el) || !isVisibleElement(el)) continue;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length < 2) continue;
        seen.add(el);

        const category = markdownCategory(el);
        const bg = effectiveBackground(el);
        const color = getComputedStyle(el).color;
        const contrast = contrastRatio(color, bg);
        const threshold = markdownThreshold(category);

        samples.push({
          category,
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className.slice(0, 160) : '',
          text: text.slice(0, 100),
          color,
          effectiveBg: bg,
          contrast,
          threshold,
          pass: typeof contrast === 'number' ? contrast >= threshold : false,
        });

        if (samples.length >= 60) return samples;
      }
    }

    return samples;
  }

  function darkTextIslands() {
    const islands = [];
    const seenParents = new Set();

    for (const container of markdownContainers()) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
          if (text.length < 2) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || isInsideCodeBlock(parent) || !isVisibleElement(parent)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let node = walker.nextNode();
      while (node && islands.length < 40) {
        const parent = node.parentElement;
        if (!seenParents.has(parent)) {
          seenParents.add(parent);
          const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
          const style = getComputedStyle(parent);
          const bg = effectiveBackground(parent);
          const contrast = contrastRatio(style.color, bg);
          const colorRgb = parseRgb(style.color);
          const darkText = colorRgb ? luminance(colorRgb) < 0.12 : false;

          if ((typeof contrast === 'number' && contrast < 4.5) || darkText) {
            islands.push({
              tag: parent.tagName,
              className: typeof parent.className === 'string' ? parent.className.slice(0, 160) : '',
              text: text.slice(0, 100),
              color: style.color,
              effectiveBg: bg,
              contrast,
              darkText,
            });
          }
        }
        node = walker.nextNode();
      }
    }

    return islands;
  }

  function isLightBackground(value) {
    const rgb = parseRgb(value);
    if (!rgb || rgb.a < 0.9) return false;
    return luminance(rgb) > 0.86;
  }

  function isLightGradient(value) {
    if (!value || value === 'none') return false;
    return /rgb\(255,\s*255,\s*255\)|rgb\(252,\s*252,\s*252\)|rgb\(249,\s*250,\s*251\)|rgb\(246,\s*245,\s*245\)|rgb\(244,\s*244,\s*244\)/.test(
      value,
    );
  }

  function codeBlockLightAncestors(pre, outer) {
    const result = [];
    let node = pre;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 8) {
      const style = getComputedStyle(node);
      if (isLightBackground(style.backgroundColor)) {
        result.push({
          tag: node.tagName,
          className: typeof node.className === 'string' ? node.className.slice(0, 160) : '',
          bg: style.backgroundColor,
        });
      }
      if (node === outer) break;
      node = node.parentElement;
      depth += 1;
    }
    return result;
  }

  function codeBlockLightMasks(outer) {
    if (!outer) return [];
    return Array.from(outer.querySelectorAll('[class*="mask" i], [class*="fade" i], [class*="gradient" i]'))
      .map((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (!isLightBackground(style.backgroundColor) && !isLightGradient(style.backgroundImage)) return null;
        return {
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className.slice(0, 160) : '',
          bg: style.backgroundColor,
          backgroundImage: style.backgroundImage.slice(0, 180),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      })
      .filter(Boolean);
  }

  function codeBlockLightHeaders(outer) {
    if (!outer) return [];
    const outerRect = outer.getBoundingClientRect();
    return Array.from(outer.querySelectorAll('*'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const className = typeof el.className === 'string' ? el.className : '';
        const namedHeader = /header|toolbar/i.test(className);
        const topWideLayer =
          rect.width > outerRect.width * 0.5 &&
          rect.height >= 16 &&
          rect.height <= 96 &&
          rect.top < outerRect.top + 80 &&
          rect.bottom > outerRect.top;
        const light = isLightBackground(style.backgroundColor) || isLightGradient(style.backgroundImage);
        if ((!namedHeader && !topWideLayer) || !light) return null;
        return {
          tag: el.tagName,
          className: className.slice(0, 160),
          text: (el.textContent || '').trim().slice(0, 80),
          bg: style.backgroundColor,
          backgroundImage: style.backgroundImage.slice(0, 180),
          top: Math.round(rect.top - outerRect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      })
      .filter(Boolean);
  }

  function auditCodeBlocks() {
    const seen = new Set();
    return Array.from(document.querySelectorAll('pre'))
      .map((pre) => {
        const outer =
          pre.closest('[class*="custom-code-block-container"], [class*="code-block-element"]') || pre.parentElement;
        if (!outer || seen.has(outer)) return null;
        seen.add(outer);

        const area = pre.closest('[class*="code-area"]');
        const header = outer.querySelector('[class*="header-wrapper"]');
        const content = pre.closest('[class*="code-content"]');
        const code = pre.querySelector('code') || pre;
        const icon = header && (header.querySelector('svg') || header.querySelector('button, [role="button"]'));
        const codeBg = effectiveBackground(code);
        const headerBg = header ? effectiveBackground(header) : null;

        return {
          language:
            Array.from(pre.classList).find((className) => className.startsWith('language-')) ||
            Array.from(code.classList).find((className) => className.startsWith('language-')) ||
            '',
          shell: styleSnapshot(outer),
          area: styleSnapshot(area),
          header: styleSnapshot(header, headerBg),
          headerIcon: icon ? styleSnapshot(icon, headerBg) : null,
          content: styleSnapshot(content),
          pre: styleSnapshot(pre),
          code: styleSnapshot(code, codeBg),
          textContrast: contrastRatio(getComputedStyle(code).color, codeBg),
          headerContrast: header ? contrastRatio(getComputedStyle(header).color, headerBg) : null,
          hasLightAncestor: codeBlockLightAncestors(pre, outer).length > 0,
          lightAncestors: codeBlockLightAncestors(pre, outer),
          hasLightHeader: codeBlockLightHeaders(outer).length > 0,
          lightHeaders: codeBlockLightHeaders(outer),
          hasLightMask: codeBlockLightMasks(outer).length > 0,
          lightMasks: codeBlockLightMasks(outer),
        };
      })
      .filter(Boolean)
      .slice(0, 10);
  }

  function visibleLightIslands() {
    return Array.from(document.querySelectorAll('body *'))
      .slice(0, 5000)
      .map((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const bg = cs.backgroundColor;
        const light = /rgb\(255, 255, 255\)|rgb\(252, 252, 252\)|rgb\(249, 250, 251\)|rgb\(246, 245, 245\)|rgb\(244, 244, 244\)/.test(bg);
        if (!light || rect.width < 12 || rect.height < 12 || cs.display === 'none' || cs.visibility === 'hidden') {
          return null;
        }
        return {
          tag: el.tagName,
          id: el.id || '',
          className: typeof el.className === 'string' ? el.className.slice(0, 160) : '',
          text: (el.textContent || '').trim().slice(0, 80),
          bg,
          area: Math.round(rect.width * rect.height),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.area - a.area)
      .slice(0, 20);
  }

  function exposeAudit() {
    window.__doubaoThemeAudit = function () {
      const root = document.documentElement;
      const themeAttrs = (el) =>
        el
          ? Object.fromEntries(
              ['data-theme', 'data-theme-mode', 'theme', 'theme-mode', 'data-doubao-auto-system-theme'].map((attr) => [
                attr,
                el.getAttribute(attr),
              ]),
            )
          : null;
      const style = document.getElementById(STYLE_ID);
      return {
        version: VERSION,
        desiredTheme: desiredTheme(),
        prefersDark: media ? media.matches : false,
        html: themeAttrs(root),
        body: themeAttrs(document.body),
        style: style ? { version: style.dataset.version, theme: style.dataset.theme } : null,
        sidebarItems: auditSidebarItems(),
        markdownText: desiredTheme() === 'dark' ? auditMarkdownText() : [],
        darkTextIslands: desiredTheme() === 'dark' ? darkTextIslands() : [],
        codeBlocks: auditCodeBlocks(),
        lightIslands: desiredTheme() === 'dark' ? visibleLightIslands() : [],
      };
    };
  }

  applyTheme('document-start');
  patchRouteChanges();
  observeTargets();
  exposeAudit();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTheme('domcontentloaded'), { once: true });
  } else {
    applyTheme('already-ready');
  }

  window.addEventListener('load', () => applyTheme('load'), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleApply('visibilitychange');
  });

  if (media) {
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', () => applyTheme('system-change'));
    } else if (typeof media.addListener === 'function') {
      media.addListener(() => applyTheme('system-change'));
    }
  }

  let warmupRuns = 0;
  const warmupTimer = window.setInterval(() => {
    warmupRuns += 1;
    applyTheme('warmup');
    if (warmupRuns >= 30) {
      window.clearInterval(warmupTimer);
    }
  }, 100);
})();
