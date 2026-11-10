"""Regenerates public/og.png (the 1200x630 link-preview image). Run: python3 ops/og-image.py  (needs Pillow, macOS fonts)"""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
top, mid, bot = (250, 249, 254), (241, 239, 249), (229, 225, 241)   # the site's background gradient
img = Image.new('RGB', (W, H))
px = img.load()
for y in range(H):
    t = y / (H - 1)
    a, b, u = (top, mid, t * 2) if t < .5 else (mid, bot, (t - .5) * 2)
    c = tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3))
    for x in range(W):
        px[x, y] = c

# soft violet glow, rings and a hexagon on the right, echoing the homepage's particle sphere
cx, cy = 985, 315
glow = Image.new('RGBA', (W, H), (155, 107, 255, 0))
ImageDraw.Draw(glow).ellipse((cx - 200, cy - 200, cx + 200, cy + 200), fill=(155, 107, 255, 120))
img = Image.alpha_composite(img.convert('RGBA'), glow.filter(ImageFilter.GaussianBlur(80)))
art = Image.new('RGBA', (W * 2, H * 2), (116, 69, 232, 0))
d2 = ImageDraw.Draw(art)
for rad, al in ((230, 130), (170, 100), (290, 60)):
    d2.ellipse(((cx - rad) * 2, (cy - rad) * 2, (cx + rad) * 2, (cy + rad) * 2), outline=(116, 69, 232, al), width=3)
hexagon = [((cx + 130 * math.cos(math.radians(60 * i - 90))) * 2, (cy + 130 * math.sin(math.radians(60 * i - 90))) * 2) for i in range(6)]
d2.polygon(hexagon, outline=(88, 48, 189, 170), width=4)
img = Image.alpha_composite(img, art.resize((W, H), Image.LANCZOS))

S = '/System/Library/Fonts/Supplemental/'
d = ImageDraw.Draw(img)
mono = ImageFont.truetype('/System/Library/Fonts/SFNSMono.ttf', 24)
d.ellipse((80, 84, 96, 100), fill=(116, 69, 232))
d.text((110, 78), 'FISHBLOOM', font=mono, fill=(43, 37, 69))
d.text((80, 214), 'Data & AI,', font=ImageFont.truetype(S + 'Arial Bold.ttf', 84), fill=(34, 27, 58))
d.text((80, 314), 'built to be verifiable.', font=ImageFont.truetype(S + 'Georgia Italic.ttf', 70), fill=(88, 48, 189))
body = ImageFont.truetype(S + 'Arial.ttf', 28)
d.text((80, 452), 'Case studies, writing and notes on', font=body, fill=(96, 88, 128))
d.text((80, 490), 'data analysis and AI applications.', font=body, fill=(96, 88, 128))
d.text((80, 566), 'fishplatform.vercel.app', font=mono, fill=(138, 130, 168))
img.convert('RGB').save('public/og.png', optimize=True)
