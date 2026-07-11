#!/usr/bin/env python3
"""Generate the deterministic 1200×630 social preview."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "og-doubao-theme.png"


def font(size: int, *, serif: bool = False, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        [
            "/System/Library/Fonts/Supplemental/Songti.ttc",
            "/System/Library/Fonts/Songti.ttc",
            "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        ]
        if serif
        else [
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    )
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def main() -> None:
    image = Image.new("RGB", (1200, 630), "#f4f1e9")
    draw = ImageDraw.Draw(image)

    for x in range(0, 1200, 42):
        draw.line((x, 0, x, 630), fill="#dfddd5", width=1)
    for y in range(0, 630, 42):
        draw.line((0, y, 1200, y), fill="#dfddd5", width=1)

    draw.rounded_rectangle((42, 38, 1158, 592), radius=22, fill="#fffdf7", outline="#c9c5ba", width=2)
    draw.rounded_rectangle((790, 38, 1158, 592), radius=22, fill="#101415")
    draw.rectangle((790, 38, 815, 592), fill="#101415")

    draw.text((78, 78), "JASON / PRODUCT SYSTEMS", font=font(20), fill="#0b625b")
    draw.text((78, 132), "让网页跟着系统变暗，", font=font(58, serif=True), fill="#171a1b")
    draw.text((78, 210), "不靠一键反色。", font=font(58, serif=True), fill="#171a1b")
    draw.text((80, 310), "DOUBAO WEB THEME ADAPTER", font=font(22, bold=True), fill="#171a1b")
    draw.text((80, 352), "sense → synchronize → repair → audit", font=font(20), fill="#666b69")

    metrics = [("04", "THEME ATTRS"), ("05", "VERIFY NODES"), ("00", "GRANTS")]
    for index, (value, label) in enumerate(metrics):
        x = 80 + index * 215
        draw.text((x, 462), value, font=font(38, bold=True), fill="#171a1b")
        draw.text((x, 515), label, font=font(14), fill="#666b69")

    draw.text((830, 82), "LIVE ADAPTATION PATH", font=font(16), fill="#7fe1d5")
    steps = [
        ("01", "SYSTEM SIGNAL"),
        ("02", "STATE SYNC"),
        ("03", "SCOPED REPAIR"),
        ("04", "CONTRAST AUDIT"),
    ]
    for index, (number, label) in enumerate(steps):
        y = 158 + index * 92
        draw.line((830, y, 1110, y), fill="#364342", width=1)
        draw.ellipse((826, y - 5, 836, y + 5), fill="#c9f77a")
        draw.text((852, y + 18), number, font=font(15), fill="#7fe1d5")
        draw.text((900, y + 16), label, font=font(16, bold=True), fill="#edf4ef")
    draw.line((830, 526, 1110, 526), fill="#364342", width=1)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, optimize=True)
    print(f"wrote {OUTPUT} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
