"""Voice server on Modal (https://modal.com): the same Node server as server.mjs (Kokoro-82M narrator voice, pt-BR), serverless, billed per second of CPU.
The free Starter plan gives US$ 30 of credit per month and, according to the plan's public page, needs no credit card; the server costs nothing while idle.
Deploy:   pip install modal && modal setup && VOICE_TOKEN=<your secret> modal deploy modal_voice.py     (run it inside this folder)
Then set in Vercel: REMOTE_TTS_URL=<the URL that deploy prints>, REMOTE_TTS_TOKEN=<same secret>, VOICE_PROVIDER=remote."""
import os
import subprocess

import modal

URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_0.tar.bz2"
here = os.path.dirname(os.path.abspath(__file__))
image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .apt_install("curl", "bzip2", "ca-certificates")
    .run_commands(
        "mkdir -p /app /models/kokoro /tmp/k",
        "cd /app && npm init -y >/dev/null && npm install sherpa-onnx-node@1.12.20 --omit=dev",
        f"curl -sL {URL} | tar xj -C /tmp/k",
        "cp /tmp/k/kokoro-int8-multi-lang-v1_0/model.int8.onnx /tmp/k/kokoro-int8-multi-lang-v1_0/voices.bin /tmp/k/kokoro-int8-multi-lang-v1_0/tokens.txt /models/kokoro/",
        "cp -r /tmp/k/kokoro-int8-multi-lang-v1_0/espeak-ng-data /models/kokoro/ && rm -rf /tmp/k",
    )
    .add_local_file(os.path.join(here, "server.mjs"), "/app/server.mjs")
)
app = modal.App("voz-professor-filipe", image=image, secrets=[modal.Secret.from_dict({"VOICE_TOKEN": os.environ.get("VOICE_TOKEN", "")})])


# measured: 8 CPUs were no faster than 4 for Kokoro (about 1.2 s of work per second of speech either way), so 4 keeps the free credit going further
@app.function(cpu=4, memory=2048, scaledown_window=420, timeout=120)
@modal.web_server(7860, startup_timeout=120, label="voz")
def serve():
    # server.mjs listens on :7860 and checks the Bearer token itself
    subprocess.Popen(["node", "/app/server.mjs"], cwd="/app", env={**os.environ, "THREADS": "4", "PORT": "7860"})
