# Builds public/maps/relief.webp: shaded relief + elevation tint of the biblical world (lon 8-50, lat 22-46) from AWS Terrain Tiles
# (SRTM/NASADEM, GEBCO and others; open data). Run scripts/media/fetch-terrain.sh first (downloads 176 tiles to /tmp/terr).
import math, glob
import numpy as np
from PIL import Image
Z = 7
tiles = {}
for f in glob.glob('/tmp/terr/t_*_*.png'):
    _, x, y = f.rsplit('/', 1)[1][:-4].split('_'); tiles[(int(x), int(y))] = f
xs = sorted({k[0] for k in tiles}); ys = sorted({k[1] for k in tiles})
W, H = len(xs) * 256, len(ys) * 256
elev = np.zeros((H, W), dtype=np.float32)
for (x, y), f in tiles.items():
    a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    elev[(y - ys[0]) * 256:(y - ys[0] + 1) * 256, (x - xs[0]) * 256:(x - xs[0] + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
# hillshade (sun from the north-west), with a vertical exaggeration for readability
res = 40075016.686 * math.cos(math.radians(34)) / (2 ** Z * 256)  # meters per pixel at ~34N
gy, gx = np.gradient(elev * 3.0, res)
slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
az, alt = math.radians(315), math.radians(42)
shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
shade = np.clip(shade, 0, 1)
# hypsometric tint for land (green lowlands -> sand -> brown -> pale peaks); the sea stays blue with a subtle depth gradient
stops = [(0, (190, 205, 150)), (150, (214, 214, 160)), (500, (226, 208, 150)), (1000, (205, 172, 118)), (1700, (170, 128, 92)), (2600, (150, 112, 90)), (3500, (235, 230, 225))]
def tint(e):
    out = np.zeros(e.shape + (3,), dtype=np.float32)
    for c in range(3):
        out[..., c] = np.interp(e, [s[0] for s in stops], [s[1][c] for s in stops])
    return out
land = elev > 0
rgb = tint(np.maximum(elev, 0))
depth = np.clip(-elev / 2500, 0, 1)[..., None]
sea = (1 - depth) * np.array([196, 222, 230]) + depth * np.array([140, 185, 205])
mix = np.where(land[..., None], rgb * (0.55 + 0.6 * shade[..., None]), sea * (0.92 + 0.12 * shade[..., None]))
img = Image.fromarray(np.clip(mix, 0, 255).astype(np.uint8))
img = img.resize((W // 2 * 1, H // 2 * 1), Image.LANCZOS) if W > 4200 else img
img.save('public/maps/relief.webp', quality=78, method=6)
# corners (lon/lat) of the mosaic in Web Mercator
def lon(x): return x / 2 ** Z * 360 - 180
def lat(y):
    n = math.pi - 2 * math.pi * y / 2 ** Z
    return math.degrees(math.atan(math.sinh(n)))
print('size', W, H, '->', img.size)
print('coords NW', lon(xs[0]), lat(ys[0]), 'NE', lon(xs[-1] + 1), lat(ys[0]), 'SE', lon(xs[-1] + 1), lat(ys[-1] + 1), 'SW', lon(xs[0]), lat(ys[-1] + 1))
