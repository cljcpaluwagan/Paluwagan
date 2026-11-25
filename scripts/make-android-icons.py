"""Replaces the default Capacitor icon (blue X on grid) and splash with the Paluwagan logo.
Runs in CI after `npx cap add android`. Only touches icon/splash resources. Package id, signing and manifest are NOT changed."""
import os
from PIL import Image, ImageDraw

RES = os.environ.get('RES_DIR', 'android/app/src/main/res')
LOGO = Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'assets', 'logo.png')).convert('RGBA')
DENS = {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}

def logo_at(px): return LOGO.resize((px, px), Image.LANCZOS)

def foreground(size):
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = int(size * 0.66)
    c.alpha_composite(logo_at(d), ((size - d) // 2, (size - d) // 2)); return c

def legacy(size, round_=False):
    c = Image.new('RGBA', (size, size), (255, 255, 255, 255)); d = int(size * (0.80 if round_ else 0.88))
    c.alpha_composite(logo_at(d), ((size - d) // 2, (size - d) // 2))
    if round_:
        m = Image.new('L', (size * 4, size * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        c.putalpha(m.resize((size, size), Image.LANCZOS))
    return c

def splash(w, h):
    c = Image.new('RGB', (w, h), (255, 255, 255)); d = int(min(w, h) * 0.42)
    c.paste(logo_at(d), ((w - d) // 2, (h - d) // 2), logo_at(d)); return c

n = 0
for name, (legacy_px, fg_px) in DENS.items():
    d = os.path.join(RES, 'mipmap-' + name); os.makedirs(d, exist_ok=True)
    legacy(legacy_px).save(os.path.join(d, 'ic_launcher.png'))
    legacy(legacy_px, True).save(os.path.join(d, 'ic_launcher_round.png'))
    foreground(fg_px).save(os.path.join(d, 'ic_launcher_foreground.png')); n += 3

# Android 8+ uses the adaptive icon XML. The Capacitor default points at vector drawables (the blue X), so point it at our PNG instead.
ad = os.path.join(RES, 'mipmap-anydpi-v26'); os.makedirs(ad, exist_ok=True)
xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n'
for f in ('ic_launcher.xml', 'ic_launcher_round.xml'): open(os.path.join(ad, f), 'w').write(xml)
for old in (os.path.join(RES, 'drawable', 'ic_launcher_background.xml'), os.path.join(RES, 'drawable-v24', 'ic_launcher_foreground.xml')):
    if os.path.exists(old): os.remove(old)
vd = os.path.join(RES, 'values'); os.makedirs(vd, exist_ok=True)
open(os.path.join(vd, 'ic_launcher_background.xml'), 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')

for root, _, files in os.walk(RES):                      # splash screens
    for f in files:
        if f == 'splash.png':
            p = os.path.join(root, f); w, h = Image.open(p).size; splash(w, h).save(p); n += 1
print(f'Wrote {n} icon/splash images and adaptive-icon XML')
import re
mf = os.path.join(os.path.dirname(RES), 'AndroidManifest.xml')
if os.path.exists(mf):
    t = open(mf, encoding='utf-8').read(); print('Manifest icon attributes:', re.findall(r'android:(?:icon|roundIcon)="[^"]+"', t))
    t2 = re.sub(r'android:icon="[^"]+"', 'android:icon="@mipmap/ic_launcher"', t); t2 = re.sub(r'android:roundIcon="[^"]+"', 'android:roundIcon="@mipmap/ic_launcher_round"', t2)
    if t2 != t: open(mf, 'w', encoding='utf-8').write(t2); print('Fixed manifest icon attributes')
for d in ('drawable', 'drawable-v24'):
    q = os.path.join(RES, d); print(d, 'still has:', [f for f in os.listdir(q) if 'launcher' in f] if os.path.isdir(q) else 'n/a')
