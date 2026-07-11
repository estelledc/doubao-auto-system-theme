#!/usr/bin/env python3
"""Assemble the explicit GitHub Pages artifact in _site/."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
ROOT_FILES = (
    "index.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    "doubao-auto-system-theme.user.js",
)


def main() -> None:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    for name in ROOT_FILES:
        shutil.copy2(ROOT / name, OUTPUT / name)
    shutil.copytree(ROOT / "assets", OUTPUT / "assets")
    print(f"built {OUTPUT} ({len(list(OUTPUT.rglob('*')))} entries)")


if __name__ == "__main__":
    main()
