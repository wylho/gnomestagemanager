#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Installs (or updates) only the extension's own folder in ~/.local/share/gnome-shell/extensions.
# It does not enable anything and does not touch other extensions or settings.
# The swap is atomic (new folder + rename): the running GNOME Shell keeps files mapped in memory
# (e.g. gschemas.compiled) and overwriting them in place could crash the session.
set -euo pipefail
UUID="stage-manager@wyliam"
HERE="$(cd "$(dirname "$0")" && pwd)"
BASE="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
DEST="$BASE/$UUID"
NEW="$BASE/.$UUID.new"
OLD="$BASE/.$UUID.old"

glib-compile-schemas "$HERE/extension/$UUID/schemas"
mkdir -p "$BASE"
rm -rf "$NEW" "$OLD"
cp -a "$HERE/extension/$UUID" "$NEW"
[ -e "$DEST" ] && mv "$DEST" "$OLD"
mv "$NEW" "$DEST"
rm -rf "$OLD"
echo "Installed to: $DEST"
echo
echo "If the extension is already loaded in this session, the new version only takes effect after you log out and back in"
echo "(GNOME Shell on Wayland cannot reload extension code). The preferences window already uses the new files."
echo "Enable (if not enabled yet):  gnome-extensions enable $UUID"
