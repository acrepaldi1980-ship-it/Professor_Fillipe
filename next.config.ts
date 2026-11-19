import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NEXT_STATIC=1 is used only by scripts/check-static-build.mjs (the Capacitor-ready build, spec 10.6.1).
  ...(process.env.NEXT_STATIC ? { output: "export" as const, images: { unoptimized: true } } : {}),
  // The local embedding model (transformers.js + ONNX) runs inside the API function: keep it out of the bundler
  // and ship only the Linux binaries (the other platforms would exceed the function size limit).
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "onnxruntime-common", "sharp"],
  // The tracer cannot see the native ONNX runtime (loaded dynamically): include it explicitly, Linux x64 only.
  outputFileTracingIncludes: {
    "/api/v1/teacher/**": ["models/**"],
    "/api/**": [
      "node_modules/onnxruntime-node/package.json",
      "node_modules/onnxruntime-node/dist/**",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
      "node_modules/onnxruntime-common/**",
    ],
  },
  outputFileTracingExcludes: {
    "/api/**": [
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime_providers_cuda.so",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime_providers_tensorrt.so",
      "node_modules/onnxruntime-web/**",
      "node_modules/@img/sharp-darwin*/**",
      "node_modules/@img/sharp-win32*/**",
      "node_modules/@img/sharp-linuxmusl*/**",
      "node_modules/@img/sharp-libvips-darwin*/**",
      "node_modules/@img/sharp-libvips-linuxmusl*/**",
    ],
  },
};

export default nextConfig;
