# Professor Filipe — avatar generation

`build_filipe.py` builds `public/models/filipe.glb` (skinned, with face morph targets) from the CC0 data of
[MPFB2 / MakeHuman](https://github.com/makehumancommunity/mpfb2) (base mesh, morph targets, rig, weights) and dresses
it with shells generated from the body surface (tunic, robe, sash, mantle, head wrap, beard, brows, eyes).

```bash
pip install bpy            # Blender as a Python module
git clone --depth 1 https://github.com/makehumancommunity/mpfb2.git /tmp/mpfb2
MPFB_DATA=/tmp/mpfb2/src/mpfb/data python3 scripts/avatar/build_filipe.py -- public/models/filipe.glb
```

Look of the character: edit `filipe.json` (age, ethnic mix, height, detail targets, expression units).
Licenses: the MPFB2 data files are CC0 (see `LICENSE.ASSETS.md` in that repository); the generated model is ours.
