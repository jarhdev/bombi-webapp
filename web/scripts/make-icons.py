"""Genera los logos e íconos de la app a partir de assets/logo-bombi.jpg.

Uso (desde web/): python3 scripts/make-icons.py
"""
from PIL import Image, ImageDraw

SRC = 'assets/logo-bombi.jpg'
CREMA = (244, 233, 215)

im = Image.open(SRC).convert('RGB')

# Solo la niña: se borra la palabra "Bombi" pintando de crema lo que está debajo de la camisa.
sin_texto = im.copy()
d = ImageDraw.Draw(sin_texto)
d.rectangle((0, 676, 1024, 1024), fill=CREMA)
sin_texto.paste(im.crop((370, 676, 600, 700)), (370, 676))  # borde inferior de la camisa
CARA = (178, 76, 848, 746)
nina = sin_texto.crop(CARA)

def lienzo(img, size, relleno):
    """Pega img centrada en un cuadrado crema, dejando `relleno` (0-0.5) de margen."""
    out = Image.new('RGB', (size, size), CREMA)
    inner = round(size * (1 - 2 * relleno))
    out.paste(img.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2,) * 2)
    return out

lienzo(nina, 256, 0.0).save('public/logo.png', optimize=True)            # encabezado (círculo)
im.resize((512, 512), Image.LANCZOS).save('public/logo-completo.png', optimize=True)  # login
lienzo(nina, 64, 0.0).save('public/favicon.png', optimize=True)
lienzo(nina, 192, 0.04).save('public/icon-192.png', optimize=True)
lienzo(nina, 512, 0.04).save('public/icon-512.png', optimize=True)
lienzo(nina, 180, 0.04).save('public/apple-touch-icon.png', optimize=True)
lienzo(nina, 512, 0.14).save('public/icon-maskable-512.png', optimize=True)  # zona segura de Android
print('listo')
