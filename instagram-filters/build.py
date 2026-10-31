"""Genera el marco de historias de Instagram de Bombi (1080x1920).

Estilo "marco de evento": la foto queda libre y la decoración vive solo
arriba (cintas satinadas + logo) y abajo (frase corta, lazo rosa
contra el cáncer de mama, @usuario).

Uso:  python3 instagram-filters/build.py [foto_de_fondo_para_preview]
Salida: instagram-filters/output/bombi-story-frame.png  (overlay transparente)
        instagram-filters/output/bombi-story-preview.jpg (vista previa)
"""
import base64
import json
import math
import pathlib
import subprocess

from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).parent
ASSETS = ROOT / "assets"
OUT = ROOT / "output"
W, H = 1080, 1920

BURGUNDY = (110, 20, 37)
PINK = (229, 154, 169)
CREAM = (246, 237, 221)


def hexc(rgb):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(c))) for c in rgb)


def data_uri(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


# ---------------------------------------------------------------- cintas

def bezier(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u**3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t**3 * d
                 for a, b, c, d in zip(p0, p1, p2, p3))


def sample(segments, n=60):
    """segments: lista de curvas cúbicas [(p0, p1, p2, p3), ...]."""
    pts = []
    for seg in segments:
        for i in range(n):
            pts.append(bezier(*seg, i / n))
    pts.append(segments[-1][3])
    return pts


def ribbon(segments, width, color, twists=0.6, phase=0.0, light=0.0):
    """Cinta satinada que gira sobre sí misma, dibujada por tramos sombreados."""
    pts = sample(segments)
    n = len(pts)
    edges = []
    for i, (x, y) in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        theta = phase + 2 * math.pi * twists * i / (n - 1)
        c = math.cos(theta)
        half = width / 2 * max(abs(c), 0.12)
        shade = 0.62 + 0.45 * abs(math.cos(theta - light))
        if c < 0:  # revés de la cinta, un poco más oscuro
            shade *= 0.82
        edges.append(((x + nx * half, y + ny * half), (x - nx * half, y - ny * half), shade))
    polys = []
    for i in range(n - 1):
        (l1, r1, s1), (l2, r2, s2) = edges[i], edges[i + 1]
        s = (s1 + s2) / 2
        # por encima de 1 se aclara hacia blanco (brillo satinado)
        fill = hexc(tuple(ch * min(s, 1) + (255 - ch) * max(0, s - 1) * 2.5 for ch in color))
        quad = " ".join(f"{px:.1f},{py:.1f}" for px, py in (l1, l2, r2, r1))
        polys.append(f'<polygon points="{quad}" fill="{fill}" stroke="{fill}" '
                     f'stroke-width="1.2" stroke-linejoin="round"/>')
    return "".join(polys)


def heart(x, y, s, fill, rot=0):
    return (f'<path transform="translate({x} {y}) rotate({rot}) scale({s})" fill="{fill}" '
            f'd="M0 8 C -14 -2, -10 -14, 0 -7 C 10 -14, 14 -2, 0 8 Z"/>')


def sparkle(x, y, s, fill):
    return (f'<path transform="translate({x} {y}) scale({s})" fill="{fill}" '
            f'd="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z"/>')


# ---------------------------------------------------------------- piezas

def top_ribbons():
    # cintas que entran por las esquinas superiores y se curvan
    return "".join([
        ribbon([((-60, 330), (40, 200), (120, 60), (360, -40))], 105, BURGUNDY, 0.7, 0.3),
        ribbon([((-60, 230), (60, 120), (150, 40), (250, -50))], 60, PINK, 0.9, 1.2),
        ribbon([((-40, 420), (10, 300), (40, 160), (150, -50))], 28, CREAM, 1.1, 0.4),
        ribbon([((1140, 360), (1030, 230), (960, 70), (710, -40))], 105, BURGUNDY, 0.7, 2.0),
        ribbon([((1140, 250), (1020, 140), (930, 50), (840, -50))], 60, PINK, 0.9, 0.2),
        ribbon([((1120, 450), (1070, 320), (1040, 170), (930, -50))], 28, CREAM, 1.1, 1.6),
    ])


def bottom_ribbons():
    # cintas que cruzan el borde inferior
    return "".join([
        ribbon([((-60, 1810), (200, 1900), (420, 1820), (620, 1865)),
                ((620, 1865), (820, 1910), (960, 1830), (1140, 1760))], 64, BURGUNDY, 1.6, 0.4),
        ribbon([((-60, 1870), (240, 1930), (520, 1850), (760, 1895)),
                ((760, 1895), (900, 1920), (1020, 1870), (1140, 1810))], 36, PINK, 1.8, 1.4),
        ribbon([((300, 1960), (500, 1870), (700, 1930), (900, 1930)),
                ((900, 1930), (1000, 1930), (1080, 1900), (1140, 1860))], 18, CREAM, 2.2, 0.8),
    ])


def awareness_ribbon(cx, cy):
    """Lazo rosa de la lucha contra el cáncer de mama."""
    rosa = (236, 120, 160)
    legs = [
        ((cx - 85, cy + 175), (cx - 30, cy + 95), (cx + 12, cy + 40), (cx + 40, cy - 30)),
        ((cx + 40, cy - 30), (cx + 74, cy - 115), (cx + 22, cy - 158), (cx, cy - 158)),
        ((cx, cy - 158), (cx - 22, cy - 158), (cx - 74, cy - 115), (cx - 40, cy - 30)),
        ((cx - 40, cy - 30), (cx - 12, cy + 40), (cx + 30, cy + 95), (cx + 85, cy + 175)),
    ]
    return ribbon(legs, 48, rosa, 0.12, 0.25, 0.9)


def svg_markup():
    girl = data_uri(ASSETS / "bombi-girl-disc.png")
    wordmark = data_uri(ASSETS / "bombi-wordmark.png")
    p, c = hexc(PINK), hexc(CREAM)

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#1e0509" flood-opacity=".45"/>
    </filter>
    <filter id="text" x="-10%" y="-30%" width="120%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#1e0509" flood-opacity=".65"/>
    </filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#2b0710" flood-opacity=".5"/>
    </filter>
  </defs>

  <!-- ARRIBA -->
  <g filter="url(#glow)">{top_ribbons()}</g>

  <g filter="url(#soft)">
    <circle cx="300" cy="215" r="104" fill="{c}"/>
    <circle cx="300" cy="215" r="96" fill="{p}"/>
  </g>
  <image href="{girl}" x="{300 - 86}" y="{215 - 86}" width="172" height="172"/>

  <g filter="url(#text)">
    <image href="{wordmark}" x="420" y="120" width="380" height="124"/>
    <text x="430" y="282" font-family="Poppins" font-weight="600" font-size="27" letter-spacing="2" fill="{c}">HANDMADE COOKIES <tspan fill="{p}">&amp; BROWNIES</tspan></text>
  </g>


  <!-- ABAJO -->
  <g filter="url(#glow)">{bottom_ribbons()}</g>
  <g filter="url(#text)">
    <text x="70" y="1690" font-family="Lora" font-style="italic" font-size="36" fill="{c}">Juntas,</text>
    <text x="70" y="1734" font-family="Lora" font-style="italic" font-size="36" fill="{c}">más fuertes <tspan fill="#ec78a0">♥</tspan></text>
  </g>
  <g filter="url(#glow)">{awareness_ribbon(915, 1700)}</g>

  <g filter="url(#text)">
    <text x="560" y="1790" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="60" fill="{c}">@bombive_</text>
    <text x="560" y="1836" text-anchor="middle" font-family="Lora" font-style="italic" font-size="32" fill="{c}">Maracay · Turmero</text>
  </g>
  {heart(760, 1600, 1.6, p, -12)}{heart(720, 1650, .9, c, 10)}{heart(345, 1610, 1.1, p, 14)}
  {sparkle(985, 1540, .8, c)}{sparkle(395, 1680, .6, c)}{sparkle(80, 420, .7, c)}{sparkle(1000, 470, .6, c)}
</svg>"""


HTML = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Lora:ital@1&display=block" rel="stylesheet">
<style>html,body{{margin:0;background:transparent}}svg{{display:block}}</style>
</head><body>{svg}</body></html>"""


def preview_background():
    """Fondo de prueba parecido a una foto (degradado + silueta)."""
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    top, bot = (150, 140, 150), (190, 180, 165)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    d.ellipse((340, 600, 740, 1000), fill=(118, 94, 84))
    d.rounded_rectangle((300, 980, 780, 1700), radius=170, fill=(68, 68, 78))
    return bg.filter(ImageFilter.GaussianBlur(2))


def render(html_path, png_path):
    """Render con el Playwright de Node (Chromium) y fondo transparente."""
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
""".format(w=W, h=H, url=json.dumps(html_path.resolve().as_uri()), png=json.dumps(str(png_path)))
    subprocess.run(["node", "-e", script], check=True)


def main(background=None):
    OUT.mkdir(exist_ok=True)
    html = OUT / "bombi-story-frame.svg.html"
    html.write_text(HTML.format(svg=svg_markup()))
    render(html, OUT / "bombi-story-frame.png")

    overlay = Image.open(OUT / "bombi-story-frame.png").convert("RGBA")
    preview = (Image.open(background).convert("RGB").resize((W, H)) if background
               else preview_background()).convert("RGBA")
    preview.alpha_composite(overlay)
    preview.convert("RGB").save(OUT / "bombi-story-preview.jpg", quality=92)


if __name__ == "__main__":
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else None)
