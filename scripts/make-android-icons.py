"""Replaces the default Capacitor launcher icons and splash with the Paluwagan logo.
Runs in CI after `npx cap add android`. Only touches image files in res/ — package id, signing and manifest are NOT changed."""
import os
from PIL import Image, ImageDraw

RES = os.environ.get('RES_DIR', 'android/app/src/main/res')
LOGO = Image.open(os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'logo.png')).convert('RGBA')

def logo_at(px):
    return LOGO.resize((px, px), Image.LANCZOS)

def foreground(size):                       # adaptive icon layer: logo inside the 66% safe zone, transparent around
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = int(size * 0.66)
    c.alpha_composite(logo_at(d), ((size - d) // 2, (size - d) // 2)); return c

def legacy(size, round_=False):             # pre-Android-8 icon: white tile (or circle) with the logo
    c = Image.new('RGBA', (size, size), (255, 255, 255, 255)); d = int(size * (0.80 if round_ else 0.88))
    c.alpha_composite(logo_at(d), ((size - d) // 2, (size - d) // 2))
    if round_:
        m = Image.new('L', (size * 4, size * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        c.putalpha(m.resize((size, size), Image.LANCZOS))
    return c

def splash(w, h):                           # white screen, logo centred
    c = Image.new('RGBA', (w, h), (255, 255, 255, 255)); d = int(min(w, h) * 0.42)
    c.alpha_composite(logo_at(d), ((w - d) // 2, (h - d) // 2)); return c

n = 0
for root, _, files in os.walk(RES):
    for f in files:
        p = os.path.join(root, f)
        if f not in ('ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png', 'splash.png'): continue
        w, h = Image.open(p).size
        img = foreground(w) if f == 'ic_launcher_foreground.png' else legacy(w, f == 'ic_launcher_round.png') if f.startswith('ic_launcher') else splash(w, h)
        img.convert('RGBA' if f != 'splash.png' else 'RGB').save(p); n += 1

bg = os.path.join(RES, 'values', 'ic_launcher_background.xml')
if os.path.isdir(os.path.dirname(bg)):
    open(bg, 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')
print(f'Replaced {n} image files with the Paluwagan logo')
