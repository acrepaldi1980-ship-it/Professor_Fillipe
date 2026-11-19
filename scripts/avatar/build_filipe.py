# "Professor Filipe": realistic-ish human built from the CC0 MakeHuman/MPFB2 data (base mesh, morph targets, rig, weights)
# plus clothing/beard/head-wrap shells generated from the body surface. No Blender add-on needed; outputs a skinned GLB.
import bpy, gzip, json, os, sys, math, random
from mathutils import Vector

bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete()
D = os.environ.get("MPFB_DATA", "/tmp/mh/mpfb2/src/mpfb/data")  # data folder of github.com/makehumancommunity/mpfb2 (CC0)
OUT = sys.argv[sys.argv.index("--") + 1]
S = 0.1
random.seed(7)

# ---------------- parse base mesh ----------------
verts, uvs, faces = [], [], []
cur = None
for line in open(f"{D}/3dobjs/base.obj"):
    p = line.split()
    if not p: continue
    if p[0] == "v": verts.append(Vector(map(float, p[1:4])))
    elif p[0] == "vt": uvs.append((float(p[1]), float(p[2])))
    elif p[0] == "g": cur = p[1]
    elif p[0] == "f": faces.append((cur, [tuple(int(x) - 1 if x else -1 for x in c.split("/")[:2]) for c in p[1:]]))

def load_target(rel):
    path = f"{D}/targets/{rel}.target.gz"
    if not os.path.exists(path): print("missing target", rel); return {}
    out = {}
    for ln in gzip.open(path, "rt"):
        if ln.startswith("#") or not ln.strip(): continue
        a = ln.split(); out[int(a[0])] = Vector((float(a[1]), float(a[2]), float(a[3])))
    return out

def apply(rel, w):
    if w:
        for i, d in load_target(rel).items(): verts[i] += d * w

cfg = json.load(open(os.environ.get("FILIPE_CFG", os.path.join(os.path.dirname(os.path.abspath(__file__)), "filipe.json"))))
age = cfg["age"]; old_w = (age - 0.5) / 0.5; young_w = 1 - old_w
for e, ew in cfg["eth"].items():
    for a, aw in (("young", young_w), ("old", old_w)): apply(f"macrodetails/{e}-male-{a}", ew * aw)
for a, aw in (("young", young_w), ("old", old_w)):
    apply(f"macrodetails/universal-male-{a}-averagemuscle-averageweight", aw)
    h = cfg["height"]
    if h > 0.5: apply(f"macrodetails/height/male-{a}-averagemuscle-averageweight-maxheight", aw * (h - 0.5) * 2)
for rel, w in cfg["details"].items(): apply(rel, w)

body_faces = [f for g, f in faces if g == "body"]
used = sorted({c[0] for f in body_faces for c in f})
GROUND = min(verts[v].y for v in used)
def C(v): return Vector((v.x, -v.z, v.y - GROUND)) * S   # MakeHuman (y up, z fwd) -> Blender (z up, -y fwd), meters, feet on floor
def Cd(d): return Vector((d.x, -d.z, d.y)) * S

# per-vertex dominant bone
wts = json.load(open(f"{D}/rigs/standard/weights.game_engine.json"))["weights"]
vw = {}
for bone, lst in wts.items():
    for vi, w in lst: vw.setdefault(vi, {})[bone] = w
def dom(vi):
    d = vw.get(vi)
    return max(d, key=d.get) if d else "pelvis"

P = {v: C(verts[v]) for v in used}   # Blender-space positions of body vertices

# landmarks (meters, Blender space; forward = -y)
def mean_of(group):
    idx = {c[0] for g, f in faces if g == group for c in f}
    return sum((C(verts[i]) for i in idx), Vector()) / len(idx)
eyeL, eyeR = mean_of("joint-l-eye"), mean_of("joint-r-eye")
EY = (eyeL.z + eyeR.z) / 2
head_bone_head = None
print("eyes", eyeL, eyeR, "EY", EY)

# vertex normals of the morphed body
nrm = {v: Vector() for v in used}
for f in body_faces:
    pts = [P[c[0]] for c in f]
    n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
    for c in f: nrm[c[0]] += n
for v in nrm: nrm[v].normalize()

# expression targets -> per-vertex deltas (Blender space)
def expr_delta(parts):
    out = {}
    for rel, w in parts:
        for i, d in load_target(rel).items(): out[i] = out.get(i, Vector()) + Cd(d) * w
    return out
EXPR = {n: expr_delta(parts) for n, parts in cfg["expr"].items()}

# ---------------- object builder ----------------
def make_body(name, face_list, offset=0.0, noise=0.0, extra=None, weights_from=None):
    """face_list: list of (verts-index corner lists). Builds a mesh, offset along normals, with weights + shape keys."""
    vs = sorted({c[0] for f in face_list for c in f}); rm = {v: i for i, v in enumerate(vs)}
    pos = []
    for v in vs:
        n = nrm.get(v, Vector((0, 0, 0)))
        o = offset + (random.uniform(-noise, noise) if noise else 0.0)
        pos.append(tuple(P[v] + n * o + (extra(v, P[v]) if extra else Vector())))
    me = bpy.data.meshes.new(name)
    me.from_pydata(pos, [], [[rm[c[0]] for c in f] for f in face_list]); me.update()
    uv = me.uv_layers.new(name="UVMap"); li = 0
    for f in face_list:
        for c in f:
            uv.data[li].uv = uvs[c[1]] if c[1] >= 0 else (0, 0); li += 1
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for bone, lst in wts.items():
        vg = None
        for vi, w in lst:
            if vi in rm:
                if vg is None: vg = ob.vertex_groups.new(name=bone)
                vg.add([rm[vi]], w, "REPLACE")
    ob.shape_key_add(name="Basis")
    for en, delta in EXPR.items():
        sk = ob.shape_key_add(name=en, from_mix=False)
        for v, i in rm.items():
            if v in delta: sk.data[i].co = sk.data[i].co + delta[v]
    return ob

def fl(pred, fs=None):
    return [f for f in (fs or body_faces) if all(pred(c[0]) for c in f)]

body = make_body("Body", body_faces)

# ---------------- rig ----------------
rig = json.load(open(f"{D}/rigs/standard/rig.game_engine.json"))
def joint_pos(spec, which):
    s = spec[which]
    if s["strategy"] == "CUBE": return mean_of(s["cube_name"])
    if s["strategy"] == "MEAN":
        pts = [C(verts[i]) for i in s["vertex_indices"]]; return sum(pts, Vector()) / len(pts)
    return C(Vector(s["default_position"]))
arm = bpy.data.armatures.new("Rig"); rob = bpy.data.objects.new("Rig", arm)
bpy.context.scene.collection.objects.link(rob); bpy.context.view_layer.objects.active = rob
bpy.ops.object.mode_set(mode="EDIT")
eb = {}
for name, spec in rig.items():
    b = arm.edit_bones.new(name); b.head = joint_pos(spec, "head"); b.tail = joint_pos(spec, "tail")
    if (b.tail - b.head).length < 0.005: b.tail = b.head + Vector((0, 0.02, 0))
    eb[name] = b
for name, spec in rig.items():
    if spec["parent"]: eb[name].parent = eb[spec["parent"]]
bpy.ops.object.mode_set(mode="OBJECT")
headB = joint_pos(rig["head"], "head"); neckTop = headB
print("head bone", headB, "neck", joint_pos(rig["neck_01"], "head"))

# ---------------- landmarks derived from the eyes ----------------
FR = lambda z: z  # helper
brow = EY + 0.020
mouthY = EY - 0.068
noseBase = EY - 0.040
chin = EY - 0.118
midx = (eyeL.x + eyeR.x) / 2
# head region: above neck, near head center
headz = headB.z
def inhead(v): return P[v].z > headz - 0.02
fwd = lambda v: -P[v].y  # larger = more forward
fwd_face = lambda v: fwd(v) > -eyeL.y - 0.075 if False else True

# eyeballs (iris + pupil painted as vertex colors on the front of the sphere)
def paint(ob, fn):
    ca = ob.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    for i, v in enumerate(ob.data.vertices): ca.data[i].color = fn(i, v)
    ob.data.color_attributes.active_color = ca
eyes = []
for nm, e in (("EyeL", eyeL), ("EyeR", eyeR)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0122, location=(e.x, e.y - 0.0015, e.z), segments=48, ring_count=32)
    o = bpy.context.active_object; o.name = nm
    for p in o.data.polygons: p.use_smooth = True
    vg = o.vertex_groups.new(name="head"); vg.add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
    def eye_col(i, v):
        n = v.co.normalized()   # local direction; front is -Y
        ang = math.acos(max(-1.0, min(1.0, -n.y)))
        if ang < 0.20: return (0.02, 0.015, 0.012, 1)            # pupil
        if ang < 0.40: return (0.30, 0.17, 0.08, 1) if ang > 0.34 or True else (0, 0, 0, 1)  # iris
        if ang < 0.47: return (0.18, 0.1, 0.05, 1)               # limbal ring
        return (0.93, 0.9, 0.86, 1)                              # sclera
    paint(o, eye_col)
    eyes.append(o)

# ---------------- clothing / hair shells (clipped smoothly against scalar fields) ----------------
hipZ = joint_pos(rig["pelvis"], "head").z
neckZ = joint_pos(rig["neck_01"], "head").z
shoulderZ = joint_pos(rig["clavicle_l"], "head").z
print("hipZ", hipZ, "neckZ", neckZ)
NEXT = [10_000_000]
def new_vertex(a, b, t):
    vid = NEXT[0]; NEXT[0] += 1
    P[vid] = P[a] * (1 - t) + P[b] * t
    n = nrm[a] * (1 - t) + nrm[b] * t; nrm[vid] = n.normalized() if n.length > 1e-6 else n
    wa, wb = vw.get(a, {}), vw.get(b, {})
    vw[vid] = {k: wa.get(k, 0.0) * (1 - t) + wb.get(k, 0.0) * t for k in set(wa) | set(wb)}
    for en, d in EXPR.items():
        da, db = d.get(a), d.get(b)
        if da is not None or db is not None: d[vid] = (da or Vector()) * (1 - t) + (db or Vector()) * t
    return vid
def tris_of(face_list):
    out = []
    for f in face_list:
        ids = [c[0] for c in f]
        for i in range(1, len(ids) - 1): out.append((ids[0], ids[i], ids[i + 1]))
    return out
def clip(tri_list, fn, c=0.0):
    out = []; cache = {}
    def cut(a, b, fa, fb):
        key = (min(a, b), max(a, b))
        if key not in cache:
            lo, hi = (a, b) if a < b else (b, a)
            flo, fhi = (fa, fb) if a < b else (fb, fa)
            cache[key] = new_vertex(lo, hi, flo / (flo - fhi))
        return cache[key]
    for tri in tri_list:
        fv = [fn(v) - c for v in tri]
        poly = []
        for i in range(3):
            a, b = tri[i], tri[(i + 1) % 3]; fa, fb = fv[i], fv[(i + 1) % 3]
            if fa >= 0: poly.append(a)
            if (fa >= 0) != (fb >= 0): poly.append(cut(a, b, fa, fb))
        for i in range(1, len(poly) - 1): out.append((poly[0], poly[i], poly[i + 1]))
    return out
def clip_all(tris, *fns):
    for fn in fns: tris = clip(tris, fn)
    return tris
def ws(v, names):
    d = vw.get(v, {}); return sum(d.get(n, 0.0) for n in names)
HAND = [f"{f}_0{i}_{s}" for f in ("index", "middle", "ring", "pinky", "thumb") for i in (1, 2, 3) for s in "lr"] + ["hand_l", "hand_r"]
LEGS = ["thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "ball_l", "ball_r"]
HEADN = ["head", "neck_01"]
ALL = tris_of(body_faces)

def make_shell(name, tris, offset=0.0, noise=0.0, extra=None):
    vs = sorted({v for t in tris for v in t}); rm = {v: i for i, v in enumerate(vs)}
    pos = []
    for v in vs:
        o = offset + (random.uniform(-noise, noise) if noise else 0.0)
        pos.append(tuple(P[v] + nrm[v] * o + (extra(v, P[v]) if extra else Vector())))
    me = bpy.data.meshes.new(name)
    me.from_pydata(pos, [], [[rm[x] for x in t] for t in tris]); me.update()
    uv = me.uv_layers.new(name="UVMap")
    for pi, p in enumerate(me.polygons):
        for li, vi in zip(p.loop_indices, p.vertices):
            q = pos[vi]; uv.data[li].uv = (q[0] * 3.0, q[2] * 3.0)
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    groups = {}
    for v, i in rm.items():
        for bone, w in vw.get(v, {}).items():
            if w > 1e-4:
                if bone not in groups: groups[bone] = ob.vertex_groups.new(name=bone)
                groups[bone].add([i], w, "REPLACE")
    ob.shape_key_add(name="Basis")
    for en, delta in EXPR.items():
        sk = ob.shape_key_add(name=en, from_mix=False)
        for v, i in rm.items():
            if v in delta: sk.data[i].co = sk.data[i].co + delta[v]
    return ob

# tunic: whole torso and arms down to the wrist (hips cut smooth), neck opening, no hands, no legs
tunic = make_shell("Tunic", clip_all(ALL, lambda v: P[v].z - (hipZ - 0.10), lambda v: 0.5 - ws(v, HAND), lambda v: 0.5 - ws(v, HEADN), lambda v: 0.5 - ws(v, LEGS)), offset=0.007)
# long robe: lathe from just under the sash to the ankles, rigged to the pelvis
hz = [P[v] for v in used if abs(P[v].z - hipZ) < 0.03 and abs(P[v].x - midx) < 0.25 and dom(v) in {"pelvis", "spine_01", "thigh_l", "thigh_r"}]
cx = (max(p.x for p in hz) + min(p.x for p in hz)) / 2; cy = (max(p.y for p in hz) + min(p.y for p in hz)) / 2
rx0 = (max(p.x for p in hz) - min(p.x for p in hz)) / 2; ry0 = (max(p.y for p in hz) - min(p.y for p in hz)) / 2
print("HIP", cx, cy, rx0, ry0)
z0 = hipZ + 0.03; hemZ = 0.06
rings, nseg = 16, 48
sk_v, sk_f = [], []
for r in range(rings + 1):
    t = r / rings; z = z0 + (hemZ - z0) * t
    flare = (0.15 + t ** 0.75) if False else (t ** 0.8)
    rx = rx0 * 1.0 + 0.19 * flare; ry = ry0 * 1.0 + 0.125 * flare
    for sgi in range(nseg):
        a = 2 * math.pi * sgi / nseg
        sk_v.append((cx + math.cos(a) * rx, cy + math.sin(a) * ry, z))
for r in range(rings):
    for sgi in range(nseg):
        a = r * nseg + sgi; b2 = r * nseg + (sgi + 1) % nseg
        sk_f.append((a, b2, b2 + nseg, a + nseg))
me = bpy.data.meshes.new("Skirt"); me.from_pydata(sk_v, [], sk_f); me.update()
for p in me.polygons: p.use_smooth = True
me.uv_layers.new(name="UVMap")
skirt = bpy.data.objects.new("Skirt", me); bpy.context.scene.collection.objects.link(skirt)
vg = skirt.vertex_groups.new(name="pelvis"); vg.add(list(range(len(sk_v))), 1.0, "REPLACE")
# sash
sash = make_shell("Sash", clip_all(ALL, lambda v: P[v].z - (hipZ - 0.01), lambda v: (hipZ + 0.075) - P[v].z, lambda v: ws(v, ["pelvis", "spine_01", "spine_02"]) - 0.5), offset=0.026)
# mantle: shoulders, upper back, upper arms; open at the front
mantle = make_shell("Mantle", clip_all(ALL,
    lambda v: ws(v, ["spine_02", "spine_03", "clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r", "neck_01"]) - 0.5,
    lambda v: P[v].z - (hipZ + 0.22),
    lambda v: (abs(P[v].x - midx) - 0.03) + 0.05 * nrm[v].y), offset=0.028, noise=0.0012)
# head wrap + brow band + nape cloth, grey hair at the temples, brows, beard
def clamp01(x): return max(0.0, min(1.0, x))
HEAD = lambda v: ws(v, ["head"]) - 0.5
wrap = make_shell("HeadWrap", clip_all(ALL, HEAD, lambda v: P[v].z - (brow + 0.012 - 0.085 * clamp01((P[v].y - (eyeL.y + 0.075)) / 0.03))), offset=0.026)
band = make_shell("HeadBand", clip_all(ALL, HEAD, lambda v: P[v].z - (brow + 0.002), lambda v: (brow + 0.030) - P[v].z), offset=0.034)
FACE_Y = -eyeL.y
beard = make_shell("Beard", clip_all(ALL,
    lambda v: ws(v, HEADN) - 0.4,
    lambda v: -P[v].y - (FACE_Y - 0.045),
    lambda v: (noseBase + 0.008 - 0.02 * clamp01((abs(P[v].x - midx) - 0.02) / 0.03)) - P[v].z,
    lambda v: P[v].z - (chin - 0.03),
    lambda v: 0.097 - abs(P[v].x - midx),
    lambda v: max(abs(P[v].x - midx) - 0.034, abs(P[v].z - (mouthY - 0.0025)) - 0.0105)),
    offset=0.009, noise=0.0035, extra=lambda v, p: Vector((0, 0, -0.03 * (mouthY - 0.03 - p.z) / 0.06)) if p.z < mouthY - 0.03 else Vector())
brows = make_shell("Brows", clip_all(ALL, HEAD, lambda v: P[v].z - (EY + 0.016), lambda v: (EY + 0.027) - P[v].z, lambda v: abs(P[v].x - midx) - 0.016, lambda v: 0.062 - abs(P[v].x - midx), lambda v: -P[v].y - FACE_Y), offset=0.0035)
head_v = lambda v: dom(v) in {"head", "neck_01"} and P[v].z > EY - 0.15

# body vertex colors
vs_body = sorted({c[0] for f in body_faces for c in f})
ca = body.data.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
for i, vi in enumerate(vs_body):
    p = P[vi]; dx = abs(p.x - midx); c = [1.0, 1.0, 1.0, 1.0]
    if head_v(vi) and -p.y > FACE_Y - 0.03:
        if dx < 0.028 and abs(p.z - mouthY) < 0.0105: c = [1.0, 0.70, 0.70, 1.0]
        elif 0.045 < dx < 0.085 and EY - 0.06 < p.z < EY - 0.015: c = [1.0, 0.90, 0.88, 1.0]
        elif dx < 0.022 and EY - 0.05 < p.z < EY - 0.025: c = [1.0, 0.88, 0.85, 1.0]
    ca.data[i].color = c
body.data.color_attributes.active_color = ca

# armature binding + export
objs = [body, tunic, skirt, sash, mantle, wrap, band, beard, brows] + eyes
for o in objs:
    o.parent = rob
    m = o.modifiers.new("Armature", "ARMATURE"); m.object = rob
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_morph=True, export_skins=True, export_yup=True, export_apply=False, export_vertex_color="ACTIVE", export_active_vertex_color_when_no_material=True)
json.dump({"eyeL": list(C(Vector((0, 0, 0)) ) ) , "EY": EY}, open(OUT + ".landmarks.json", "w"))
print("OK", OUT)
