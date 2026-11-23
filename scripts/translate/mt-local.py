"""Free, local English -> Portuguese machine translation for the library (no key, no quota, no cost).
Opus-MT "tc-big" (Helsinki-NLP, CC BY 4.0) converted to CTranslate2 int8, run on the CPU of the machine.
Reads JSON lines {id, secs:[{n, text}]} and appends JSON lines {id, answer:"[§n] ...\n\n[§m] ..."} (resumable: skips ids already answered).
Usage: /opt/mt/bin/python scripts/translate/mt-local.py <in.jsonl> <out.jsonl> [model_dir]"""
import json, os, re, sys, time
import ctranslate2, sentencepiece as spm

IN, OUT = sys.argv[1], sys.argv[2]
D = sys.argv[3] if len(sys.argv) > 3 else "/opt/mt-model/tcbig"
tr = ctranslate2.Translator(D, device="cpu", inter_threads=1, intra_threads=max(2, (os.cpu_count() or 4)), compute_type="int8")
sp = spm.SentencePieceProcessor(model_file=D + "/source.spm")
tp = spm.SentencePieceProcessor(model_file=D + "/target.spm")

# Consecrated Portuguese forms (the model prints some old spellings); applied after translation.
FIX = [(r"\bJudéia\b", "Judeia"), (r"\bIdéia\b", "Ideia"), (r"\bidéia\b", "ideia"), (r"\bplatéia\b", "plateia"), (r"\bassembléia\b", "assembleia"), (r"\bAssembléia\b", "Assembleia"),
       (r"\bPôncio Pilatos\b", "Pôncio Pilatos"), (r"\bTiago, irmão de Jesus\b", "Tiago, irmão de Jesus"), (r"\bCrestus\b", "Chrestus")]

ABBR = re.compile(r"(?:\b(?:Mr|Mrs|St|Dr|vs|etc|cf|ch|chap|lib|book|vol|Ant|War|Life|Apion|Ap|No|nos|viz|i\.e|e\.g|ver|vers|v|vv|p|pp|sect|Sect)\.|\b[A-Z]\.|\d\.)$")

def sentences(par: str):
    parts, cur = [], ""
    for tok in re.split(r"(?<=[.!?])\s+(?=[\"“‘'(\[]?[A-Z])", par):
        cur = (cur + " " + tok).strip() if cur else tok
        if ABBR.search(cur):
            continue
        parts.append(cur); cur = ""
    if cur: parts.append(cur)
    # very long sentences are cut at ; or : (the model loses text on long input)
    out = []
    for s in parts:
        if len(s.split()) > 90:
            sub = re.split(r"(?<=[;:])\s+", s)
            buf = ""
            for x in sub:
                if buf and len((buf + " " + x).split()) > 70: out.append(buf); buf = x
                else: buf = (buf + " " + x).strip()
            if buf: out.append(buf)
        else: out.append(s)
    return out

def translate(texts):
    """Translates a list of sentences; results in the same order. Sorted by length for efficient batching, one retry for suspicious outputs."""
    order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
    src = [sp.encode(">>por<< " + texts[i], out_type=str) + ["</s>"] for i in order]
    res = tr.translate_batch(src, beam_size=3, max_batch_size=1500, batch_type="tokens", max_decoding_length=400, repetition_penalty=1.05)
    out = [None] * len(texts)
    for k, i in enumerate(order):
        out[i] = tp.decode(res[k].hypotheses[0]).strip()
    for i, t in enumerate(texts):
        a, b = len(t.split()), len(out[i].split())
        if a >= 6 and (b < 0.55 * a or b > 2.4 * a):
            r = tr.translate_batch([sp.encode(">>por<< " + t, out_type=str) + ["</s>"]], beam_size=6, max_decoding_length=400, repetition_penalty=1.2)
            alt = tp.decode(r[0].hypotheses[0]).strip()
            if 0.55 * a <= len(alt.split()) <= 2.4 * a or abs(len(alt.split()) - a) < abs(b - a): out[i] = alt
    return out

def fix(s: str) -> str:
    for a, b in FIX: s = re.sub(a, b, s)
    return s

def do_request(secs):
    # flatten every sentence of every paragraph of every section, translate at once, then put it back
    plan = []  # (sec index, paragraph index, [sentence indexes])
    flat = []
    meta = []
    for si, s in enumerate(secs):
        text = s["text"]; prefix = ""
        m = re.match(r"^([\w.]+) \|\| (.*)$", text, re.S)
        if m: prefix, text = m.group(1) + " || ", m.group(2)
        pars = [p for p in re.split(r"\n+", text) if p.strip()]
        meta.append((prefix, [[len(flat) + j for j in range(0)] for _ in pars]))
        paras = []
        for p in pars:
            idx = []
            for sent in sentences(p.strip()):
                idx.append(len(flat)); flat.append(sent)
            paras.append(idx)
        meta[-1] = (prefix, paras)
    tx = translate(flat) if flat else []
    parts = []
    for si, s in enumerate(secs):
        prefix, paras = meta[si]
        body = "\n\n".join(" ".join(tx[i] for i in idx) for idx in paras)
        parts.append(f"[§{s['n']}] {prefix}{fix(body)}")
    return "\n\n".join(parts)

done = set()
if os.path.exists(OUT):
    for line in open(OUT):
        try: done.add(json.loads(line)["id"])
        except Exception: pass
n = 0; t0 = time.time(); words = 0
with open(OUT, "a") as out:
    for line in open(IN):
        r = json.loads(line)
        if r["id"] in done: continue
        ans = do_request(r["secs"])
        out.write(json.dumps({"id": r["id"], "answer": ans}, ensure_ascii=False) + "\n"); out.flush()
        n += 1; words += sum(len(s["text"].split()) for s in r["secs"])
        if n % 10 == 0: print(f"{n} requests, {words} words, {words / (time.time() - t0):.0f} words/s", flush=True)
print(f"done: {n} requests, {words} words in {time.time() - t0:.0f}s", flush=True)
