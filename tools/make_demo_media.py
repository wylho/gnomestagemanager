#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Monta o GIF e as imagens do README a partir da gravação do cenário `showcase` do sandbox.

  SANDBOX_DARK=1 SANDBOX_DEMO=/tmp/demo sandbox/run-shell.sh sandbox/scenarios/showcase.js 260 1920x1080 stage-manager@wyliam
  python3 tools/make_demo_media.py

Usa ffmpeg (GIF com paleta própria) e ImageMagick (JPEG). A gravação usa o Shell com as animações desaceleradas
(slow_down_factor) e cada quadro leva a duração real dividida por esse fator, então a animação sai em velocidade normal.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "sandbox", "out")
DOCS = os.path.join(ROOT, "docs", "screenshots")
WIDTH = int(os.environ.get("GIF_WIDTH", "960"))
FPS = int(os.environ.get("GIF_FPS", "12"))


def main():
    frames = json.load(open(os.path.join(OUT, "frames.json")))
    os.makedirs(DOCS, exist_ok=True)
    listing = os.path.join(OUT, "frames.txt")
    with open(listing, "w") as f:
        for fr in frames:
            f.write(f"file '{os.path.join(OUT, fr['f'])}'\nduration {fr['d'] / 1000:.3f}\n")
        f.write(f"file '{os.path.join(OUT, frames[-1]['f'])}'\n")
    gif = os.path.join(DOCS, "demo.gif")
    vf = (f"fps={FPS},scale={WIDTH}:-1:flags=lanczos,split[a][b];"
          "[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listing, "-vf", vf, "-loop", "0", gif], check=True)
    print(f"demo.gif: {os.path.getsize(gif) / 1e6:.1f} MB")
    for still, name in [("still-stage", "stage-and-strip"), ("still-mosaic", "mosaic-group"),
                        ("still-autotile", "autotiling"), ("still-menu", "context-menu")]:
        src = os.path.join(OUT, f"{still}.png")
        if os.path.exists(src):
            dst = os.path.join(DOCS, f"{name}.jpg")
            subprocess.run(["convert", src, "-resize", "1600x", "-quality", "86", dst], check=True)
            print(f"{name}.jpg: {os.path.getsize(dst) / 1e3:.0f} KB")


if __name__ == "__main__":
    sys.exit(main())
