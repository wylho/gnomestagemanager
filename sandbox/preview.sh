#!/usr/bin/env bash
# Prévia sem sair da sessão: sobe um GNOME Shell isolado, roda um roteiro e deixa PNGs em sandbox/out/.
# Uso: preview.sh [roteiro] [monitores] [only-primary]
#   roteiro:      nome em scenarios/ sem .js (padrão: interact)     ex.: mosaic, mosaic2, lifecycle, env, chaos
#   monitores:    ex. 1920x1080  ou  1920x1080,1280x720             (padrão: 1920x1080)
#   only-primary: true|false (org.gnome.mutter workspaces-only-on-primary, padrão: false = como na sua sessão)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCEN="${1:-interact}"; MON="${2:-1920x1080}"; export SANDBOX_ONLY_PRIMARY="${3:-false}"
"$HERE/run-shell.sh" "$HERE/scenarios/$SCEN.js" 240 "$MON" stage-manager@wyliam,ubuntu-dock@ubuntu.com
echo; echo "Imagens:"; ls -1 "$HERE"/out/*.png 2>/dev/null || echo "(este roteiro não gera imagens)"
