# Kokoro voice server (free-tier friendly). Build: docker build -t voice-server .   Run: docker run -p 7860:7860 -e VOICE_TOKEN=... voice-server
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl bzip2 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm init -y >/dev/null && npm install sherpa-onnx-node --omit=dev
# Kokoro-82M int8 (Apache-2.0): keep only what Portuguese needs
RUN mkdir -p /models/kokoro /tmp/k && curl -sL https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_0.tar.bz2 | tar xj -C /tmp/k \
 && cp /tmp/k/kokoro-int8-multi-lang-v1_0/model.int8.onnx /tmp/k/kokoro-int8-multi-lang-v1_0/voices.bin /tmp/k/kokoro-int8-multi-lang-v1_0/tokens.txt /models/kokoro/ \
 && cp -r /tmp/k/kokoro-int8-multi-lang-v1_0/espeak-ng-data /models/kokoro/ && rm -rf /tmp/k
COPY server.mjs .
ENV NODE_ENV=production
EXPOSE 7860
CMD ["node", "server.mjs"]
