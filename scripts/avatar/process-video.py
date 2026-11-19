# Greeting video: replaces the white studio background by the app's warm "stage" (blurred Acts 8 scene + soft light),
# so the figure sits in the screen instead of looking cut out and pasted. Keeps the original audio.
# Usage: python3 scripts/avatar/process-video.py   (needs ffmpeg, Pillow, numpy)
import os, subprocess, shutil, glob
import numpy as np
from PIL import Image, ImageFilter

SRC = "docs/identidade/avatar-final/boas-vindas.mp4"
SCENE = "docs/identidade/avatar-final/cena-atos-8-eunuco.jpg"
OUT = "public/avatar/boas-vindas.mp4"
TMP = "/tmp/av/frames"; shutil.rmtree(TMP, ignore_errors=True); os.makedirs(TMP)
W, H = 720, 1280

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-vf", "fps=24", f"{TMP}/in_%04d.png"], check=True)
frames = sorted(glob.glob(f"{TMP}/in_*.png"))

# backdrop: right part of the scene (palms, desert, sky), blurred, warm light at the bottom
sc = Image.open(SCENE).convert("RGB")
cw = int(sc.width * 0.2); ch = int(cw * H / W)        # right edge of the scene: palms, horses and sand, no people
x0 = sc.width - cw; y0 = int(sc.height * 0.18)
bg = sc.crop((x0, y0, x0 + cw, min(sc.height, y0 + ch))).resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(10))
bg = np.asarray(bg).astype(np.float32) * 1.05
yy, xx = np.mgrid[0:H, 0:W]
glow = np.exp(-(((xx - W / 2) / (W * 0.55)) ** 2 + ((yy - H * 0.86) / (H * 0.32)) ** 2))[..., None]
bg = np.clip(bg * (1 - 0.35 * glow) + np.array([255, 238, 205]) * 0.35 * glow, 0, 255)
shade = np.linspace(0.0, 0.12, H)[:, None, None]  # a little warm veil towards the bottom
bg = np.clip(bg * (1 - shade) + np.array([246, 239, 226]) * shade, 0, 255)

for i, f in enumerate(frames):
    fg = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
    d = (255 - fg).max(axis=2)                       # distance from white
    a = np.clip((d - 12) / 40.0, 0, 1)               # soft key: white -> 0, colour -> 1
    a_img = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    a = np.asarray(a_img).astype(np.float32)[..., None] / 255.0
    # unmix the white halo on soft edges
    fgc = np.clip((fg - (1 - a) * 255) / np.maximum(a, 0.05), 0, 255)
    out = fgc * a + bg * (1 - a)
    Image.fromarray(out.astype(np.uint8)).save(f"{TMP}/out_{i + 1:04d}.png")

subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "24", "-i", f"{TMP}/out_%04d.png", "-i", SRC, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", OUT], check=True)
Image.open(f"{TMP}/out_0001.png").convert("RGB").save("public/avatar/boas-vindas-poster.webp", "WEBP", quality=85)
print("ok", os.path.getsize(OUT) // 1024, "KB")
