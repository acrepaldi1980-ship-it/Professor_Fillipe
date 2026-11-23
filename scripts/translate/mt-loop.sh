#!/usr/bin/env bash
# Translates the whole library into Portuguese with the free local model, in chunks, writing each chunk to the database (so progress survives a restart).
# Usage: NODE_OPTIONS=--use-env-proxy scripts/translate/mt-loop.sh   (resumes where it stopped)
cd "$(dirname "$0")/../.."
T="node --env-file=.env.local --import tsx scripts/translate/josephus-pt.ts"
for i in $(seq 1 60); do
  out=$($T run --provider local --limit 250 2>&1 | grep -v "UNDICI\|trace-warn")
  echo "$out" | tail -3
  echo "$out" | grep -q "^0 requests" && { echo "nothing left to translate"; break; }
  $T apply 2>&1 | grep -v "UNDICI\|trace-warn" | tail -1
  echo "$out" | grep -q "merged 0 answers" && { echo "no progress; stopping"; break; }
done
