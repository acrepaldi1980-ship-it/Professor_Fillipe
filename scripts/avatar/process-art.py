# Cuts the owner's avatar art (docs/identidade/avatar-final) out of its white background and writes the web assets in
# public/avatar. The cut is eroded by ~1.5 px and softened so no white fringe is left around the figure.
# Usage: python3 scripts/avatar/process-art.py   (needs Pillow and numpy)
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

D = "docs/identidade/avatar-final/"
OUT = "public/avatar/"

def cutout(im, thresh=40, step=30, erode=2):
    im = im.convert("RGB"); w, h = im.size; tmp = im.copy()
    seeds = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] + [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    for s in seeds:
        px = tmp.getpixel(s)
        if min(px) > 225 and px != (255, 0, 255):
            ImageDraw.floodfill(tmp, s, (255, 0, 255), thresh=thresh)
    a = np.asarray(tmp); bg = (a[:, :, 0] == 255) & (a[:, :, 1] == 0) & (a[:, :, 2] == 255)
    al = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8))
    for _ in range(erode):  # eat the light halo at the border
        al = al.filter(ImageFilter.MinFilter(3))
    # the painted floor shadow is a pale grey patch under the feet: drop it (the app draws its own contact shadow)
    rgb = np.asarray(im).astype(np.int16); h_ = rgb.shape[0]
    pale = (rgb.min(axis=2) > 150) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 28)
    pale[: int(h_ * 0.82)] = False
    arr = np.asarray(al).copy(); arr[pale] = 0; al = Image.fromarray(arr)
    al = al.filter(ImageFilter.GaussianBlur(1.0))
    out = im.convert("RGBA"); out.putalpha(al)
    return out

def on_canvas(out, cw, ch):
    bb = out.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox(); out = out.crop(bb)
    s = min((cw - 20) / out.width, (ch - 10) / out.height)
    o2 = out.resize((int(out.width * s), int(out.height * s)), Image.LANCZOS)
    c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0)); c.alpha_composite(o2, ((cw - o2.width) // 2, ch - o2.height)); return c

def head_cx(c):
    arr = np.asarray(c)[:, :, 3] > 128; rows = np.where(arr.any(axis=1))[0]; top = rows[0]
    cols = np.where(arr[top:top + 170].any(axis=0))[0]; return int((cols[0] + cols[-1]) // 2)

def save(c, name):
    c.save(OUT + name + ".webp", "WEBP", quality=90, method=6); print(name, "cx", head_cx(c))

# sheet with four poses (captions painted over)
sheet = Image.open(D + "poses-4-estados.png").convert("RGB"); W, H = sheet.size
d = ImageDraw.Draw(sheet)
for box in [(25, 312, 138, 338), (425, 312, 522, 338), (25, 805, 120, 832), (425, 805, 522, 832)]:
    d.rectangle(box, fill=(255, 255, 255))
for name, box in {"boas-vindas": (0, 0, W // 2, H // 2), "ensinando-mao": (W // 2, 0, W, H // 2), "parabens": (0, H // 2, W // 2, H)}.items():
    p = sheet.crop(box); p = p.resize((p.width * 2, p.height * 2), Image.LANCZOS); save(on_canvas(cutout(p), 700, 1000), name)
for name, src in [("refletindo", "refletindo.png"), ("ensinando", "ensinando.png")]:
    save(on_canvas(cutout(Image.open(D + src)), 700, 1000), name)
for name, src in [("acolhimento", "acolhimento-mao-no-peito.jpg"), ("apontando", "apontando-pergaminho.jpg"), ("ideia", "ideia-lamparina.jpg")]:
    im = Image.open(D + src); im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS); save(on_canvas(cutout(im), 700, 1000), name)
# four faces (bust), mouth shapes
f = Image.open(D + "rosto-4-expressoes.jpg").convert("RGB"); fw, fh = f.size
for n, (x, y) in {"fechada": (0, 0), "falando": (fw // 2, 0), "aberta": (0, fh // 2), "sorriso": (fw // 2, fh // 2)}.items():
    p = f.crop((x, y, x + fw // 2, y + fh // 2)).resize((800, 800), Image.LANCZOS)
    cutout(p).save(OUT + f"rosto-{n}.webp", "WEBP", quality=88, method=6)
