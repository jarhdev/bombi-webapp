"""Genera los marcos de historia de Instagram de Bombi (1080x1920).

Uso:  python3 instagram-filters/build.py
Salida: instagram-filters/output/*.png  (overlay transparente + vista previa)
"""
import base64
import json
import pathlib
import subprocess

from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).parent
ASSETS = ROOT / "assets"
OUT = ROOT / "output"
W, H = 1080, 1920

BURGUNDY = "#6E1425"
BURGUNDY_DARK = "#4E0D19"
PINK = "#E59AA9"
CREAM = "#F6EDDD"
CARAMEL = "#C99A63"


def data_uri(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def drip_path(base, drips):
    """Banda superior con goteo de chocolate. drips = [(x, ancho, largo)]."""
    d = [f"M -40 -40 L {W + 40} -40 L {W + 40} {base}"]
    for x, w, length in sorted(drips, reverse=True):
        r = w / 2
        s = w * 0.55  # suavizado del hombro
        bottom = base + length
        d.append(f"L {x + r + s} {base}")
        d.append(f"C {x + r + s * 0.35} {base} {x + r} {base + s * 0.4} {x + r} {base + s}")
        d.append(f"L {x + r} {bottom - r}")
        d.append(f"A {r} {r} 0 0 1 {x - r} {bottom - r}")
        d.append(f"L {x - r} {base + s}")
        d.append(f"C {x - r} {base + s * 0.4} {x - r - s * 0.35} {base} {x - r - s} {base}")
    d.append(f"L -40 {base} Z")
    return " ".join(d)


def scallop_path(top, radius):
    """Base inferior con festón de caja de pastelería."""
    n = round(W / (2 * radius))
    step = W / n
    d = [f"M -40 {H + 40} L -40 {top} L 0 {top}"]
    for i in range(n):
        x1 = (i + 1) * step
        d.append(f"A {step / 2} {radius} 0 0 1 {x1} {top}")
    d.append(f"L {W + 40} {top} L {W + 40} {H + 40} Z")
    return " ".join(d)


TOP_DRIPS = [
    (55, 30, 62), (150, 22, 32), (468, 28, 82), (532, 18, 34), (615, 34, 138),
    (702, 20, 42), (790, 28, 72), (882, 40, 108), (975, 22, 38), (1042, 30, 64),
]


def svg_markup():
    girl = data_uri(ASSETS / "bombi-girl-disc.png")
    wordmark = data_uri(ASSETS / "bombi-wordmark.png")
    top = drip_path(300, TOP_DRIPS)
    bottom = scallop_path(1752, 26)

    # brillos en los goteos (efecto glaseado)
    shines = "".join(
        f'<rect x="{x + w * 0.12}" y="{300 + w * 0.2}" width="{w * 0.18}" '
        f'height="{max(length - w * 0.9, 8)}" rx="{w * 0.09}" fill="#fff" opacity=".22"/>'
        for x, w, length in TOP_DRIPS if length > 50
    )
    # chispas decorativas sobre la banda
    sprinkles = "".join(
        f'<rect x="{x}" y="{y}" width="16" height="5" rx="2.5" fill="{c}" '
        f'transform="rotate({a} {x + 8} {y + 2.5})"/>'
        for x, y, a, c in [
            (40, 60, -30, PINK), (120, 230, 25, CREAM), (60, 160, 60, CARAMEL),
            (980, 270, -20, PINK), (1010, 60, 40, CREAM), (900, 40, -55, CARAMEL),
            (470, 40, 15, PINK), (420, 250, -40, CARAMEL), (1030, 180, 10, PINK),
        ]
    )

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#2b0710" flood-opacity=".35"/>
    </filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#2b0710" flood-opacity=".4"/>
    </filter>
    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{BURGUNDY_DARK}"/>
      <stop offset="1" stop-color="{BURGUNDY}"/>
    </linearGradient>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{BURGUNDY}"/>
      <stop offset="1" stop-color="{BURGUNDY_DARK}"/>
    </linearGradient>
    <path id="stampRing" d="M 0 -80 A 80 80 0 1 1 -0.01 -80"/>
  </defs>

  <!-- marco fino -->
  <rect x="34" y="34" width="1012" height="1852" rx="52" fill="none" stroke="{CREAM}" stroke-width="5" opacity=".95"/>
  <rect x="48" y="48" width="984" height="1824" rx="42" fill="none" stroke="{PINK}" stroke-width="2.5" opacity=".9"/>

  <!-- BANDA SUPERIOR: rosa + crema + goteo de chocolate -->
  <g filter="url(#shadow)">
    <path d="{top}" fill="{PINK}" stroke="{PINK}" stroke-width="40" stroke-linejoin="round"/>
    <path d="{top}" fill="{CREAM}" stroke="{CREAM}" stroke-width="20" stroke-linejoin="round"/>
    <path d="{top}" fill="url(#band)"/>
  </g>
  {shines}
  {sprinkles}

  <!-- logo -->
  <g filter="url(#soft)">
    <circle cx="275" cy="200" r="140" fill="{CREAM}"/>
    <circle cx="275" cy="200" r="130" fill="{PINK}"/>
  </g>
  <image href="{girl}" x="{275 - 116}" y="{200 - 116}" width="232" height="232"/>

  <image href="{wordmark}" x="440" y="70" width="430" height="140"/>
  <text x="452" y="250" font-family="Poppins" font-weight="500" font-size="32" letter-spacing="2" fill="{CREAM}">HANDMADE COOKIES</text>
  <text x="452" y="290" font-family="Poppins" font-weight="500" font-size="32" letter-spacing="2" fill="{PINK}">&amp; BROWNIES</text>

  <!-- etiqueta EST. 2020 colgando del logo -->
  <g filter="url(#soft)">
    <rect x="205" y="330" width="140" height="44" rx="22" fill="{CREAM}" stroke="{BURGUNDY}" stroke-width="3"/>
  </g>
  <text x="275" y="360" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="21" letter-spacing="3" fill="{BURGUNDY}">EST. 2020</text>

  <!-- BASE INFERIOR: festón -->
  <g filter="url(#shadow)">
    <path d="{bottom}" fill="{PINK}" stroke="{PINK}" stroke-width="44" stroke-linejoin="round"/>
    <path d="{bottom}" fill="{CREAM}" stroke="{CREAM}" stroke-width="22" stroke-linejoin="round"/>
    <path d="{bottom}" fill="url(#base)"/>
  </g>
  <text x="430" y="1848" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="64" fill="{CREAM}">@bombive_</text>
  <text x="430" y="1894" text-anchor="middle" font-family="Lora" font-style="italic" font-size="32" fill="{PINK}">Maracay · Turmero</text>

  <!-- sello "hecho a mano" -->
  <g transform="translate(905 1715) rotate(-10)">
    <g filter="url(#soft)">
      <circle r="112" fill="{CREAM}"/>
    </g>
    <circle r="102" fill="none" stroke="{BURGUNDY}" stroke-width="4"/>
    <circle r="54" fill="none" stroke="{PINK}" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round"/>
    <text font-family="Poppins" font-weight="700" font-size="18" fill="{BURGUNDY}">
      <textPath href="#stampRing" textLength="496" lengthAdjust="spacing">HECHO A MANO • HORNEADO CON AMOR •</textPath>
    </text>
    <path transform="translate(0 4) scale(2.2)" fill="{PINK}"
          d="M0 8 C -14 -2, -10 -14, 0 -7 C 10 -14, 14 -2, 0 8 Z"/>
    <text y="-26" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="15" letter-spacing="2" fill="{BURGUNDY}">100%</text>
    <text y="46" text-anchor="middle" font-family="Lora" font-style="italic" font-size="22" fill="{BURGUNDY}">artesanal</text>
  </g>

  <!-- corazones -->
  <g fill="{PINK}">
    <path transform="translate(770 1640) scale(1.4) rotate(-12)" d="M0 8 C -14 -2, -10 -14, 0 -7 C 10 -14, 14 -2, 0 8 Z"/>
    <path transform="translate(735 1690) scale(.8) rotate(10)" d="M0 8 C -14 -2, -10 -14, 0 -7 C 10 -14, 14 -2, 0 8 Z" fill="{CREAM}"/>
  </g>
  <g fill="{CREAM}" opacity=".95">
    <path transform="translate(110 1690)" d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z"/>
    <path transform="translate(150 1650) scale(.55)" d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z"/>
  </g>
</svg>"""


HTML = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&family=Lora:ital@1&display=block" rel="stylesheet">
<style>html,body{{margin:0;background:transparent}}svg{{display:block}}</style>
</head><body>{svg}</body></html>"""


def preview_background():
    """Fondo de prueba parecido a una foto (degradado + silueta)."""
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    top, bot = (150, 120, 130), (205, 190, 150)
    for y in range(H):
        t = y / H
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = c
    d = ImageDraw.Draw(bg)
    d.ellipse((340, 600, 740, 1000), fill=(118, 94, 84))
    d.rounded_rectangle((300, 980, 780, 1700), radius=170, fill=(68, 68, 78))
    return bg.filter(ImageFilter.GaussianBlur(2))


def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "bombi-story-frame.svg.html").write_text(HTML.format(svg=svg_markup()))
    # Render con el Playwright de Node (Chromium) y fondo transparente
    script = """
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch();
  const p = await b.newPage({{ viewport: {{ width: {w}, height: {h} }} }});
  await p.goto({url}, {{ waitUntil: 'networkidle' }});
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({{ path: {png}, omitBackground: true }});
  await b.close();
}})();
""".format(w=W, h=H, url=json.dumps((OUT / "bombi-story-frame.svg.html").resolve().as_uri()),
           png=json.dumps(str(OUT / "bombi-story-frame.png")))
    subprocess.run(["node", "-e", script], check=True)

    overlay = Image.open(OUT / "bombi-story-frame.png").convert("RGBA")
    preview = preview_background().convert("RGBA")
    preview.alpha_composite(overlay)
    preview.convert("RGB").save(OUT / "bombi-story-preview.jpg", quality=92)


if __name__ == "__main__":
    main()
