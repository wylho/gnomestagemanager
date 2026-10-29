<h1 align="center">Stage Manager for GNOME</h1>

<p align="center">
  <b>The macOS window organizer, rebuilt for GNOME — plus everything Apple left out.</b><br>
  One centered window. Everything else, one click away. Tiling when you want it.
</p>

<p align="center">
  <img alt="GNOME Shell 50" src="https://img.shields.io/badge/GNOME%20Shell-50-4A86CF?logo=gnome&logoColor=white">
  <img alt="Wayland" src="https://img.shields.io/badge/Wayland-tested-2ea44f">
  <img alt="License" src="https://img.shields.io/badge/license-GPL--3.0--or--later-blue">
  <img alt="Languages" src="https://img.shields.io/badge/languages-9-orange">
</p>

<p align="center">
  <img src="docs/screenshots/demo.gif" alt="Stage Manager for GNOME in action: swapping stages, building a group, autotiling, context menu" width="900">
</p>

> Português: [README.pt-BR.md](README.pt-BR.md)

## Why you'll love it

- **Focus by default.** The active window (or group) sits centered on the *stage*. Everything else waits in a side *strip* of
  **live thumbnails** that keep updating while hidden, with the native minimize animation flying to and from it.
- **Groups in one gesture.** Drag a thumbnail onto the stage, **Shift+click** it, or hit the **+** button. Drag a window back to the
  strip to remove it. The strip even shows a drop target when it is empty.
- **Two ways to tile, your choice.** **Mosaic** keeps each window's shape and makes room when you resize one. **Autotiling**
  (Pop Shell style) fills the screen with a tree layout, moves dividers as you resize, and swaps windows when you drop one onto another.
- **Picture-in-Picture that behaves.** Firefox/Chrome PiP joins the stage where it appears and leaves with it; only its **width**
  takes part in tiling, the height follows the video, in the corner you pick.
- **Built for real setups.** One stage per monitor and per workspace, strip on either side (works with a bottom dock), wallpaper click to
  peek at the desktop, GNOME Quick Settings toggle, Wayland-native.
- **Yours to tweak.** 20+ options, 9 shortcuts, a right-click menu on every thumbnail, a point-and-click *exceptions* picker,
  and 9 languages.

## Everything it does, next to macOS

*macOS column: Apple's documentation and published reviews ("—" = not documented). See [docs/ESPECIFICACAO.pt-BR.md](docs/ESPECIFICACAO.pt-BR.md) for the research.*

| | macOS Stage Manager | This extension |
|---|:---:|:---:|
| Active window/group centered on a stage | Yes | **Yes** |
| Strip of recent apps with live thumbnails | Yes | **Yes** |
| Click a thumbnail to swap (the old one takes its slot) | Yes | **Yes** |
| Build groups by dragging from the strip | Yes | **Yes** |
| Shift+click to add a window to the stage | Yes | **Yes** |
| Drag a window back to the strip to remove it | Yes | **Yes** |
| Strip tucked behind windows, revealed at the screen edge | Yes | **Yes** |
| Auto-hide the strip | Yes | **Yes** |
| Click the wallpaper to reveal the desktop | Yes | **Yes** |
| "One at a time" / "All at once" windows per app | Yes | **Yes** |
| One stage per display and per workspace | Yes | **Yes** |
| Quick toggle in the system menu | Yes | **Yes** |
| **Keyboard shortcuts** for toggling, switching, adding, removing, rearranging | No | **Yes (9, configurable)** |
| **Right-click menu** on thumbnails (bring, add, split, close, quit, move to monitor/workspace, ignore…) | No | **Yes** |
| **+ button** on thumbnails (can be turned off) | No | **Yes** |
| **Automatic arrangement** of a group (windows never overlap) | No (free-floating) | **Mosaic or autotiling** |
| **Autotiling** with configurable margin and gap, dividers that follow your resizing | — | **Yes** |
| Resize one window and the others make room (it keeps the size you asked for) | — | **Yes** |
| Resize from the center: on by default, or only while holding **Alt** (outside autotiling) | Option key, app-dependent | **Yes** |
| Drop a window onto another to swap places | — | **Yes** |
| **Picture-in-Picture** handled as a width-only tile in a corner | — | **Yes** |
| **Exceptions picker**: click any window to ignore its app (GNOME Sushi ignored by default) | — | **Yes** |
| "**Always keep centered**" mode, or remember windows you moved by hand | — | **Yes** |
| Move a set to another monitor or workspace from the menu | — | **Yes** |
| Drag windows **and strip thumbnails between monitors**: drop on a strip item to group, on the strip to just move, or on an open window to choose *Group* or *Only move here* | — | **Yes** |
| **Alt+Tab in order of use** with several monitors (one tap = the app you just left) | Yes (Command-Tab) | **Yes** |
| Translations | System languages | **9 (EN, PT-BR, ES, FR, DE, RU, IT, ZH-CN, JA)** |

## A quick tour

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/stage-and-strip.jpg" alt="The stage and the strip"><br><b>Stage and strip.</b> One centered window; the rest as live thumbnails.</td>
    <td width="50%"><img src="docs/screenshots/mosaic-group.jpg" alt="A two-window mosaic group"><br><b>Mosaic.</b> Add a window to the stage and the group arranges itself.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/autotiling.jpg" alt="Autotiling layout"><br><b>Autotiling.</b> Windows fill the screen; the strip stays on the side.</td>
    <td width="50%"><img src="docs/screenshots/context-menu.jpg" alt="The context menu on a thumbnail"><br><b>Right-click menu.</b> Everything you can do with a thumbnail.</td>
  </tr>
</table>

## Install

```bash
git clone https://github.com/wylho/gnomestagemanager.git
cd gnomestagemanager
./install.sh                           # copies to ~/.local/share/gnome-shell/extensions (enables nothing)
# log out and back in (Wayland only discovers new extensions that way), then:
gnome-extensions enable stage-manager@wyliam
```

Requires **GNOME Shell 50** (developed and tested on Ubuntu 26.04, Wayland) and `glib-compile-schemas` (`libglib2.0-bin`).
Tips: dock at the bottom (`gsettings set org.gnome.shell.extensions.dash-to-dock dock-position BOTTOM`); stop GNOME from auto-maximizing
new windows (`gsettings set org.gnome.mutter auto-maximize false`); turn off other tiling/window managers (Pop Shell, etc.), they fight over positions.

## Shortcuts (all configurable)

| Action | Default |
|---|---|
| Turn Stage Manager on/off | `Super+Alt+S` |
| Turn autotiling on/off | `Super+Alt+T` |
| Switch to the most recent set in the strip | `Super+Alt+Up` |
| Add the most recent set to the stage | `Super+Alt+Right` |
| Remove the focused window from the group | `Super+Alt+Left` |
| Rearrange / center the group | `Super+Alt+R` |
| Show the desktop | `Super+Alt+D` |
| Pick a window to ignore (with the mouse) | `Super+Alt+E` |
| Ignore / manage again the focused app | `Super+Alt+X` |

## Make it yours

Open *Preferences* (or right-click a thumbnail > Preferences). Highlights: strip side and thumbnail width, show/hide recents, one-at-a-time
vs all-at-once, mosaic vs free vs autotiling (margin, gap, strip visibility), always-center and remember-position, PiP corner/width/title
patterns, the + button, wallpaper click, exceptions list, and every shortcut.

## Built to be trusted

Window managers are unforgiving, so this one is tested like it:

- **Isolated GNOME Shell sandbox** (`sandbox/`): a headless shell with its own D-Bus, settings and Wayland socket that runs scripted scenarios
  (mouse, keyboard, real GNOME apps) and saves screenshots, so changes are checked without logging out. The demo above was recorded in it.
- **Chaos test**: random open/close/swap/minimize/maximize/move-to-monitor/toggle operations, checking invariants after every step,
  on 1 and 2 monitors in both GNOME workspace modes.
- Unit tests for the layout, tiling tree and model; atomic installs that never touch a running Shell's files.
- Designed from a study of Apple's docs, Ars Technica, MacStories, Six Colors, Eclectic Light and others, including what reviewers
  disliked (no shortcuts, laborious grouping, strip getting in the way).

```bash
sandbox/preview.sh interact                    # try it without logging out -> sandbox/out/*.png
sandbox/preview.sh mosaic2 1920x1080,1280x720  # two monitors
tests/run-all.sh                               # unit + chaos tests
```

## Translations

English (source) plus Brazilian Portuguese, Spanish, French, German, Russian, Italian, Simplified Chinese and Japanese (`po/*.po`).
**They were produced with AI assistance and not yet reviewed by native speakers: corrections are very welcome.**

```bash
sudo apt install python3-babel
python3 tools/i18n.py extract && python3 tools/i18n.py update   # refresh from the code
python3 tools/i18n.py check && python3 tools/i18n.py compile    # verify, then build the .mo files
```

## Honest limits

- GNOME Shell **50 only** for now (other versions untested); developed on Wayland, X11 untested.
- Picture-in-Picture is recognized by window title (`Picture-in-Picture`, `Picture in picture`; editable). It was tested with simulated PiP windows; real Firefox/Chrome PiP needs more field testing, so please report what you see.
- Groups are not persisted across restarts. Windows that cannot be minimized stay visible. Code of an extension already running only reloads after you log out and in (a Wayland limitation).
- Code comments are in Portuguese.

## See also

Other GNOME projects with the same inspiration, with different goals and strengths, worth a look:
[Stage Manager (extensions.gnome.org)](https://extensions.gnome.org/extension/9528/stage-manager/)
(GNOME 46–50, X11 and Wayland, several sidebar modes). Pick the one that fits your setup.

## Contributing

Issues and PRs are welcome, especially translations, other GNOME versions and X11 testing. Run `tests/run-all.sh` before sending a PR.

## License

Copyright (C) 2026 wylho. Licensed under the **GNU General Public License, version 3 or (at your option) any later version**
(`GPL-3.0-or-later`); see [LICENSE](LICENSE). Contributions are accepted under the same license.
