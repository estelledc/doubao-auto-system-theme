#!/usr/bin/env python3
"""Validate the public case, userscript evidence, and deployment contract."""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://estelledc.github.io/doubao-auto-system-theme/"
REQUIRED_SECTIONS = {"case-title", "problem", "system", "role", "evidence", "install", "limitations"}
PORTFOLIO_LINKS = {
    "https://estelledc.github.io/",
    "https://estelledc.github.io/about/",
    "https://estelledc.github.io/resume/",
    "https://github.com/estelledc/doubao-auto-system-theme",
}
ACTION_RE = re.compile(r"^\s*(?:-\s*)?uses:\s*([^\s#]+)", re.MULTILINE)


class Signals(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.tag_counts: dict[str, int] = {}
        self.hrefs: list[str] = []
        self.srcs: list[str] = []
        self.canonicals: list[str] = []
        self.metas: dict[str, str] = {}
        self.json_ld: list[str] = []
        self._json_buffer: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.tag_counts[tag] = self.tag_counts.get(tag, 0) + 1
        values = {key: value or "" for key, value in attrs}
        if values.get("id"):
            self.ids.add(values["id"])
        if values.get("href"):
            self.hrefs.append(values["href"])
        if values.get("src"):
            self.srcs.append(values["src"])
        if tag == "link" and "canonical" in values.get("rel", "").split():
            self.canonicals.append(values.get("href", ""))
        if tag == "meta":
            key = values.get("name") or values.get("property")
            if key:
                self.metas[key] = values.get("content", "")
        if tag == "script" and values.get("type") == "application/ld+json":
            self._json_buffer = []

    def handle_data(self, data: str) -> None:
        if self._json_buffer is not None:
            self._json_buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._json_buffer is not None:
            self.json_ld.append("".join(self._json_buffer))
            self._json_buffer = None


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError(f"{path} is not a PNG")
    return struct.unpack(">II", data[16:24])


def local_target(base: Path, reference: str) -> Path | None:
    parsed = urlparse(reference)
    if parsed.scheme or parsed.netloc or reference.startswith(("#", "mailto:", "tel:")):
        return None
    clean = unquote(parsed.path)
    if not clean:
        return None
    return (base / clean.lstrip("/")).resolve()


def check_page(base: Path, errors: list[str]) -> None:
    page = base / "index.html"
    if not page.exists():
        errors.append(f"missing {page}")
        return
    source = page.read_text(encoding="utf-8")
    signals = Signals()
    signals.feed(source)

    if signals.canonicals != [SITE_URL]:
        errors.append(f"canonical mismatch: {signals.canonicals}")
    missing_sections = REQUIRED_SECTIONS - signals.ids
    if missing_sections:
        errors.append(f"missing section ids: {sorted(missing_sections)}")
    missing_portfolio = PORTFOLIO_LINKS - set(signals.hrefs)
    if missing_portfolio:
        errors.append(f"missing portfolio links: {sorted(missing_portfolio)}")
    for key in (
        "description",
        "og:type",
        "og:title",
        "og:description",
        "og:url",
        "og:image",
        "twitter:card",
        "twitter:title",
        "twitter:description",
        "twitter:image",
    ):
        if not signals.metas.get(key):
            errors.append(f"missing metadata: {key}")
    if signals.metas.get("twitter:card") != "summary_large_image":
        errors.append("twitter card is not summary_large_image")
    if len(signals.json_ld) != 1:
        errors.append(f"expected one JSON-LD block, found {len(signals.json_ld)}")
    else:
        try:
            payload = json.loads(signals.json_ld[0])
        except json.JSONDecodeError as exc:
            errors.append(f"invalid JSON-LD: {exc}")
        else:
            graph = payload.get("@graph", [])
            software = next((item for item in graph if item.get("@type") == "SoftwareApplication"), {})
            person = next((item for item in graph if item.get("@type") == "Person"), {})
            expected = {"softwareVersion": "1.0.0", "isAccessibleForFree": True}
            for key, value in expected.items():
                if software.get(key) != value:
                    errors.append(f"JSON-LD {key} mismatch")
            if person.get("@id") != "https://estelledc.github.io/#person" or person.get("name") != "Jason Xun":
                errors.append("JSON-LD shared Jason Xun #person identity mismatch")
            if software.get("author", {}).get("@id") != "https://estelledc.github.io/#person":
                errors.append("JSON-LD software author does not reference #person")
    for reference in signals.hrefs + signals.srcs:
        target = local_target(base, reference)
        if target and not target.exists():
            errors.append(f"broken local reference: {reference}")
    for marker in (
        "4 theme attributes",
        "5 delayed checks",
        "@grant none",
        "非官方用户脚本",
        "不读取、保存或上传聊天内容",
        "Run demo audit",
        "DEMO DOM AUDIT",
        "LAST COMPAT VERIFY",
        "2026-07-11 · static contract only",
        "LIVE DOUBAO",
        "UNKNOWN",
        "DEGRADED",
        "JavaScript 未启用",
    ):
        if marker not in source:
            errors.append(f"homepage lost evidence marker: {marker}")


def check_not_found(base: Path, errors: list[str]) -> None:
    page = base / "404.html"
    if not page.exists():
        errors.append(f"missing {page}")
        return
    source = page.read_text(encoding="utf-8")
    signals = Signals()
    signals.feed(source)

    expected_canonical = f"{SITE_URL}404.html"
    if signals.canonicals != [expected_canonical]:
        errors.append(f"404 canonical mismatch: {signals.canonicals}")
    if signals.metas.get("robots") != "noindex, nofollow":
        errors.append("404 must be noindex, nofollow")
    if signals.json_ld:
        errors.append("404 must not publish JSON-LD")
    missing_portfolio = PORTFOLIO_LINKS - set(signals.hrefs)
    if missing_portfolio:
        errors.append(f"404 missing portfolio links: {sorted(missing_portfolio)}")
    for href in ("./", "./#install", "#main"):
        if href not in signals.hrefs:
            errors.append(f"404 missing recovery route: {href}")
    for tag in ("main", "h1", "footer"):
        if signals.tag_counts.get(tag, 0) != 1:
            errors.append(f"404 expected exactly one <{tag}>, found {signals.tag_counts.get(tag, 0)}")
    for key in ("description", "og:title", "og:description", "og:url", "twitter:card", "twitter:title", "twitter:description"):
        if not signals.metas.get(key):
            errors.append(f"404 missing metadata: {key}")
    for reference in signals.hrefs + signals.srcs:
        target = local_target(base, reference)
        if target and not target.exists():
            errors.append(f"404 broken local reference: {reference}")
    for marker in ("404 / Route drift", "信号没有抵达", "2 EXPLICIT", "Network requests", "NO RESPONSE"):
        if marker not in source:
            errors.append(f"404 lost recovery marker: {marker}")
    if "<script" in source:
        errors.append("404 should remain script-free")


def check_userscript(errors: list[str]) -> None:
    script = (ROOT / "doubao-auto-system-theme.user.js").read_text(encoding="utf-8")
    checks = {
        "version 1.0.0": bool(re.search(r"^//\s+@version\s+1\.0\.0\s*$", script, re.MULTILINE)),
        "grant none": bool(re.search(r"^//\s+@grant\s+none\s*$", script, re.MULTILINE)),
        "chat match": "// @match        https://www.doubao.com/chat/*" in script,
        "four theme attrs": "['data-theme', 'data-theme-mode', 'theme', 'theme-mode']" in script,
        "five verify delays": "[0, 50, 250, 1000, 3000]" in script,
        "system theme listener": "prefers-color-scheme: dark" in script,
        "mutation repair": "MutationObserver" in script and "post-apply-drift" in script,
        "route repair": "pushState" in script and "replaceState" in script and "popstate" in script,
        "audit API": "window.__doubaoThemeAudit" in script,
    }
    for label, passed in checks.items():
        if not passed:
            errors.append(f"userscript contract missing: {label}")
    for key in ("sidebarItems", "markdownText", "darkTextIslands", "codeBlocks", "lightIslands"):
        if f"{key}:" not in script:
            errors.append(f"audit surface missing: {key}")
    forbidden_network = {
        "fetch(": r"\bfetch\s*\(",
        "XMLHttpRequest": r"\bXMLHttpRequest\b",
        "WebSocket": r"\bWebSocket\b",
        "sendBeacon": r"\bsendBeacon\b",
    }
    for label, pattern in forbidden_network.items():
        if re.search(pattern, script):
            errors.append(f"privacy claim invalid: userscript contains {label}")


def check_assets(base: Path, errors: list[str]) -> None:
    og = base / "assets" / "og-doubao-theme.png"
    try:
        size = png_size(og)
    except (OSError, ValueError) as exc:
        errors.append(str(exc))
    else:
        if size != (1200, 630):
            errors.append(f"OG image is {size}, expected (1200, 630)")
    version = base / "assets" / "jx" / "VERSION"
    if not version.exists() or version.read_text(encoding="utf-8").strip() != "2.1.0":
        errors.append("Jason DS is missing or not v2.1.0")
    css = (base / "assets" / "showcase.css").read_text(encoding="utf-8")
    for marker in (
        ":focus-visible",
        "prefers-reduced-motion",
        "@media (max-width: 640px)",
        ".demo-audit__table-wrap { overflow-x: auto; }",
        ".demo-audit__meta { grid-template-columns: 1fr; }",
    ):
        if marker not in css:
            errors.append(f"CSS contract missing: {marker}")

    demo = (base / "assets" / "showcase.js").read_text(encoding="utf-8")
    for marker in (
        "auditDemoSurface",
        "getComputedStyle",
        "sidebarItems",
        "markdownText",
        "darkTextIslands",
        "codeBlocks",
        "lightIslands",
        'runAudit.hidden = false',
        'textContent = "STALE · RUN AGAIN"',
        'auditResults?.querySelectorAll("[data-status]")',
        'badge.dataset.status = "unknown"',
        'badge.textContent = "STALE"',
    ):
        if marker not in demo:
            errors.append(f"demo audit implementation missing: {marker}")


def check_workflows(errors: list[str]) -> None:
    workflows = sorted((ROOT / ".github" / "workflows").glob("*.y*ml"))
    if not workflows:
        errors.append("no GitHub Actions workflows")
    for workflow in workflows:
        workflow_source = workflow.read_text(encoding="utf-8")
        if "node --test tests/*.test.mjs" not in workflow_source:
            errors.append(f"{workflow.name}: showcase behavior tests are not enforced")
        for action in ACTION_RE.findall(workflow_source):
            if action.startswith(("./", "docker://")):
                continue
            ref = action.rsplit("@", 1)[-1] if "@" in action else ""
            if not re.fullmatch(r"[0-9a-f]{40}", ref):
                errors.append(f"{workflow.name}: action not pinned to full SHA ({action})")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--built", action="store_true", help="also validate _site output")
    args = parser.parse_args()
    errors: list[str] = []
    check_page(ROOT, errors)
    check_not_found(ROOT, errors)
    check_assets(ROOT, errors)
    check_userscript(errors)
    check_workflows(errors)
    if args.built:
        built = ROOT / "_site"
        check_page(built, errors)
        check_not_found(built, errors)
        check_assets(built, errors)
        if not (built / "doubao-auto-system-theme.user.js").exists():
            errors.append("built artifact is missing userscript")
    if errors:
        print("SHOWCASE CHECK FAILED:")
        for error in errors:
            print(f"  - {error}")
        return 1
    print("OK: case + 404, live sample-DOM audit, explicit UNKNOWN/DEGRADED/STALE states, 4 theme attrs, 5 verification nodes, 5 audit surfaces, privacy and pinned workflows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
