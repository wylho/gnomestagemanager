#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Sobe um GNOME Shell isolado (headless, monitor virtual): bus D-Bus próprio, GSettings em arquivo
# próprio, socket Wayland próprio. Não toca na sessão real.
# Uso: run-shell.sh <roteiro.js> [segundos] [WxH] [extensões separadas por vírgula]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$(readlink -f "$1")"; LIFE="${2:-60}"; RES="${3:-1920x1080}"; EXTS="${4:-}"
export XDG_DATA_HOME="$HERE/data" XDG_CONFIG_HOME="$HERE/config" XDG_CACHE_HOME="$HERE/cache"
# Idioma do shell de teste: inglês por padrão (os roteiros procuram os textos em inglês). Ex.: SANDBOX_LANG=pt_BR.UTF-8
export LANG="${SANDBOX_LANG:-C.UTF-8}" LANGUAGE=
export GSETTINGS_BACKEND=keyfile SANDBOX_OUT="$HERE/out" SANDBOX_HERE="$HERE" SANDBOX_SCRIPT="$SCRIPT"
rm -rf "$SANDBOX_OUT"; mkdir -p "$XDG_CACHE_HOME" "$SANDBOX_OUT" "$XDG_CONFIG_HOME"
# Extensões do sandbox: links criados a cada execução (nada disto é versionado).
rm -rf "$XDG_DATA_HOME"   # estado limpo a cada execução (apps restauram sessão a partir daqui)
EXTDIR="$XDG_DATA_HOME/gnome-shell/extensions"; mkdir -p "$EXTDIR"
ln -sfn "$HERE/driver/driver@sandbox" "$EXTDIR/driver@sandbox"
ln -sfn "$HERE/../extension/stage-manager@wyliam" "$EXTDIR/stage-manager@wyliam"
rm -f "$XDG_CONFIG_HOME/glib-2.0/settings/keyfile"
LIST="'driver@sandbox'"; IFS=',' read -ra E <<< "$EXTS"; for e in "${E[@]}"; do [ -n "$e" ] && LIST="$LIST, '$e'"; done
gsettings set org.gnome.shell enabled-extensions "[$LIST]"
gsettings set org.gnome.shell disable-user-extensions false
[ -n "${SANDBOX_DARK:-}" ] && gsettings set org.gnome.desktop.interface color-scheme prefer-dark
gsettings set org.gnome.shell welcome-dialog-last-shown-version '99'
# padrão do GNOME é true; a sessão real do usuário usa false. SANDBOX_ONLY_PRIMARY=true|false escolhe.
gsettings set org.gnome.mutter workspaces-only-on-primary "${SANDBOX_ONLY_PRIMARY:-true}"
# monitores: "1920x1080" ou "1920x1080,1280x720"
VM=(); IFS=',' read -ra R <<< "$RES"; for r in "${R[@]}"; do VM+=(--virtual-monitor "$r"); done
# dock do Ubuntu: mesmas opções do usuário, embaixo
if [[ ",$EXTS," == *",ubuntu-dock@ubuntu.com,"* ]]; then
  for kv in "dock-position BOTTOM" "dock-fixed true" "extend-height false" "autohide true" "intellihide true" "click-action minimize" "dash-max-icon-size 32"; do
    set -- $kv; gsettings set org.gnome.shell.extensions.dash-to-dock "$1" "$2"
  done
fi
timeout --signal=TERM "$LIFE" dbus-run-session -- gnome-shell --headless --wayland --no-x11 \
  --wayland-display=wayland-sandbox "${VM[@]}" > "$SANDBOX_OUT/shell.log" 2>&1
echo "== run.log"; cat "$SANDBOX_OUT/run.log" 2>/dev/null
