#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Roda os testes unitários e o teste de caos (1 e 2 monitores, nos dois modos de áreas de trabalho).
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
gjs -m tests/unit.mjs 2>&1 | tail -1
for cfg in "1920x1080 false" "1920x1080,1280x720 true" "1920x1080,1280x720 false"; do
  set -- $cfg
  printf "caos [%s, only-primary=%s]: " "$1" "$2"
  SANDBOX_ONLY_PRIMARY=$2 sandbox/run-shell.sh sandbox/scenarios/chaos.js 300 "$1" stage-manager@wyliam 2>&1 | grep -E "^FIM|^!!|ERROR" | head -3
done
